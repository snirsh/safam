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
      balance: Math.round(balance),
    };
  });

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return { totalBalance, accounts };
}

/**
 * Calculate CC liability for a given month:
 *   SUM of expense amounts on credit card accounts within the month.
 *   This is what will be deducted from the bank next month.
 */
export async function calculateCCLiability(
  householdId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<CCLiabilityResult> {
  const rows = await db
    .select({
      accountId: financialAccounts.id,
      accountName: financialAccounts.name,
      totalExpenses: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(financialAccounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.accountId, financialAccounts.id),
        eq(transactions.transactionType, "expense"),
        gte(transactions.date, monthStart),
        lt(transactions.date, monthEnd),
      ),
    )
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.accountType, "credit_card"),
      ),
    )
    .groupBy(financialAccounts.id, financialAccounts.name);

  const accounts = rows.map((r) => ({
    accountId: r.accountId,
    accountName: r.accountName,
    liability: Math.round(Math.abs(Number(r.totalExpenses))),
  }));

  const totalLiability = accounts.reduce((sum, a) => sum + a.liability, 0);

  return { totalLiability, accounts };
}
