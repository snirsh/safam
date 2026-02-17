import { db } from "@/lib/db";
import { financialAccounts, transactions } from "@/lib/db/schema";
import { eq, and, sql, gte, lt } from "drizzle-orm";

export interface AccountBalance {
  accountId: string;
  accountName: string;
  balance: number;
}

export interface BankBalanceResult {
  totalBalance: number;
  accounts: AccountBalance[];
}

export interface CCLiabilityResult {
  totalLiability: number;
  accounts: Array<{
    accountId: string;
    accountName: string;
    liability: number;
  }>;
}

/**
 * Calculate actual bank balance per account:
 *   startingBalance + SUM(income) - SUM(expense) - SUM(transfer)
 */
export async function calculateBankBalance(
  householdId: string,
): Promise<BankBalanceResult> {
  const rows = await db
    .select({
      accountId: financialAccounts.id,
      accountName: financialAccounts.name,
      startingBalance: financialAccounts.startingBalance,
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      totalTransfers: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.transactionType} = 'transfer' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(financialAccounts)
    .leftJoin(transactions, eq(transactions.accountId, financialAccounts.id))
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.accountType, "bank"),
      ),
    )
    .groupBy(financialAccounts.id, financialAccounts.name, financialAccounts.startingBalance);

  const accounts: AccountBalance[] = rows.map((r) => {
    const balance =
      Number(r.startingBalance) +
      Number(r.totalIncome) -
      Number(r.totalExpenses) -
      Number(r.totalTransfers);
    return {
      accountId: r.accountId,
      accountName: r.accountName,
      balance,
    };
  });

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return { totalBalance, accounts };
}

/**
 * Compute billing cycle boundaries for a CC account.
 * The cycle that "hits bank next month" is the CURRENT open cycle:
 * from this month's (billingDay+1) to next month's (billingDay+1).
 * Example: billingDay=2, current month=Feb → cycle is Feb 3 – Mar 3 (exclusive).
 * These charges will be debited from the bank on ~Mar 2.
 * Falls back to calendar month if billingDay is null.
 */
const getBillingCycleBounds = (
  billingDay: number | null,
  monthStart: Date,
  monthEnd: Date,
): { cycleStart: Date; cycleEnd: Date } => {
  if (billingDay === null) {
    return { cycleStart: monthStart, cycleEnd: monthEnd };
  }

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();

  // Current open cycle: charges from (thisMonth billingDay+1) to (nextMonth billingDay+1)
  const cycleStart = new Date(year, month, billingDay + 1);
  const cycleEnd = new Date(year, month + 1, billingDay + 1);

  return { cycleStart, cycleEnd };
};

/**
 * Calculate CC liability for the current billing cycle:
 *   SUM of expense amounts on credit card accounts within their billing cycle.
 *   Each CC account uses its own billingDay to determine the date range.
 *   This is what will be deducted from the bank next month.
 */
export async function calculateCCLiability(
  householdId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<CCLiabilityResult> {
  // First, fetch CC accounts with their billingDay
  const ccAccounts = await db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      billingDay: financialAccounts.billingDay,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.accountType, "credit_card"),
      ),
    );

  if (ccAccounts.length === 0) {
    return { totalLiability: 0, accounts: [] };
  }

  // Calculate liability per account using its specific billing cycle
  const accounts: CCLiabilityResult["accounts"] = [];

  for (const acct of ccAccounts) {
    const { cycleStart, cycleEnd } = getBillingCycleBounds(
      acct.billingDay,
      monthStart,
      monthEnd,
    );

    const [row] = await db
      .select({
        totalExpenses: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, acct.id),
          eq(transactions.transactionType, "expense"),
          gte(sql`COALESCE(${transactions.processedDate}, ${transactions.date})`, cycleStart),
          lt(sql`COALESCE(${transactions.processedDate}, ${transactions.date})`, cycleEnd),
        ),
      );

    const liability = Math.abs(Number(row?.totalExpenses ?? 0));
    accounts.push({
      accountId: acct.id,
      accountName: acct.name,
      liability,
    });
  }

  const totalLiability = accounts.reduce((sum, a) => sum + a.liability, 0);

  return { totalLiability, accounts };
}
