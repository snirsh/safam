import { db } from "@/lib/db";
import {
  transactions,
  recurringPatterns,
  categories,
  financialAccounts,
} from "@/lib/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { calculateBankBalance, calculateCCLiability } from "@/lib/balance/calculate";

export interface ForecastPendingItem {
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryName: string | null;
  categoryIcon: string | null;
}

export interface ForecastDataPoint {
  date: string; // YYYY-MM-DD
  balance: number;
  label?: string;
  items?: ForecastPendingItem[];
}

export interface PendingRecurring {
  id: string;
  description: string;
  expectedAmount: number;
  expectedDate: string;
  type: "income" | "expense";
  accountType: "bank" | "credit_card";
  categoryName: string | null;
  categoryIcon: string | null;
}

export interface ForecastResult {
  bankBalance: number;
  projectedEndOfMonth: number;
  isSafe: boolean;
  ccLiability: number;
  totalPendingBankIncome: number;
  totalPendingBankExpenses: number;
  dataPoints: ForecastDataPoint[];
  pendingRecurring: PendingRecurring[];
}

/**
 * Calculate a bank-centric balance projection for the current month.
 *
 * - Starts from actual bank balance (startingBalance + all bank txns)
 * - Projects forward using only bank recurring patterns
 * - CC patterns are included in the list but tagged and excluded from projection
 * - CC liability is calculated separately as informational
 */
export async function calculateForecast(
  householdId: string,
): Promise<ForecastResult> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // 1. Actual bank balance
  const { totalBalance: bankBalance } = await calculateBankBalance(householdId);

  // 2. CC liability this month
  const { totalLiability: ccLiability } = await calculateCCLiability(
    householdId,
    monthStart,
    monthEnd,
  );

  // 3. Fetch active recurring patterns with category + account info
  const parentCategories = alias(categories, "parent_categories");
  const patterns = await db
    .select({
      id: recurringPatterns.id,
      description: recurringPatterns.description,
      expectedAmount: recurringPatterns.expectedAmount,
      nextExpectedDate: recurringPatterns.nextExpectedDate,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      parentCategoryName: parentCategories.name,
      accountType: financialAccounts.accountType,
    })
    .from(recurringPatterns)
    .leftJoin(categories, eq(recurringPatterns.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .leftJoin(
      financialAccounts,
      eq(recurringPatterns.accountId, financialAccounts.id),
    )
    .where(
      and(
        eq(recurringPatterns.householdId, householdId),
        eq(recurringPatterns.isActive, true),
      ),
    );

  // 4. Get this month's transaction descriptions for fulfillment matching
  const monthTxns = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        gte(transactions.date, monthStart),
        lt(transactions.date, monthEnd),
      ),
    );

  const monthDescriptions = monthTxns.map((t) => ({
    desc: t.description.trim().toLowerCase(),
    amount: Math.abs(Number(t.amount)),
  }));

  // 5. Determine which patterns are still pending
  const pendingRecurring: PendingRecurring[] = [];

  for (const pattern of patterns) {
    const expectedAmt = Number(pattern.expectedAmount);
    const normalizedDesc = pattern.description.trim().toLowerCase();

    // Check if already fulfilled this month
    const fulfilled = monthDescriptions.some((t) => {
      const descMatch =
        t.desc.includes(normalizedDesc) || normalizedDesc.includes(t.desc);
      const amountTolerance = expectedAmt * 0.2;
      const amountMatch = Math.abs(t.amount - expectedAmt) <= amountTolerance;
      return descMatch && amountMatch;
    });

    if (fulfilled) continue;

    // Check if expected within current month
    const expectedDate = pattern.nextExpectedDate;
    if (!expectedDate) continue;
    if (expectedDate < monthStart || expectedDate >= monthEnd) continue;

    const isIncome =
      pattern.parentCategoryName === "Income" ||
      (pattern.categoryName === "Income" && pattern.parentCategoryName === null);
    const accountType = pattern.accountType ?? "bank";

    // For chart projection, overdue items are applied to today
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const effectiveDate = expectedDate < today ? today : expectedDate;

    pendingRecurring.push({
      id: pattern.id,
      description: pattern.description,
      expectedAmount: expectedAmt,
      expectedDate: effectiveDate.toISOString().slice(0, 10),
      type: isIncome ? "income" : "expense",
      accountType,
      categoryName: pattern.categoryName,
      categoryIcon: pattern.categoryIcon,
    });
  }

  // 6. Build daily data points from today to end of month
  //    Only BANK patterns affect the projection line
  const bankPending = pendingRecurring.filter((p) => p.accountType === "bank");

  const dataPoints: ForecastDataPoint[] = [];
  let runningBalance = bankBalance;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(monthEnd.getTime() - 1);

  for (
    let d = new Date(today);
    d <= lastDay;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);

    const todaysPending = bankPending.filter(
      (p) => p.expectedDate === dateStr,
    );

    for (const p of todaysPending) {
      if (p.type === "income") {
        runningBalance += p.expectedAmount;
      } else {
        runningBalance -= p.expectedAmount;
      }
    }

    const point: ForecastDataPoint = {
      date: dateStr,
      balance: Math.round(runningBalance),
    };
    if (todaysPending.length > 0) {
      point.label = todaysPending.map((p) => p.description).join(", ");
      point.items = todaysPending.map((p) => ({
        description: p.description,
        amount: p.expectedAmount,
        type: p.type,
        categoryName: p.categoryName,
        categoryIcon: p.categoryIcon,
      }));
    }

    dataPoints.push(point);
  }

  // 7. Compute totals (bank only)
  const totalPendingBankIncome = bankPending
    .filter((p) => p.type === "income")
    .reduce((sum, p) => sum + p.expectedAmount, 0);
  const totalPendingBankExpenses = bankPending
    .filter((p) => p.type === "expense")
    .reduce((sum, p) => sum + p.expectedAmount, 0);

  const projectedEndOfMonth =
    dataPoints.length > 0
      ? dataPoints[dataPoints.length - 1]!.balance
      : bankBalance;

  return {
    bankBalance: Math.round(bankBalance),
    projectedEndOfMonth,
    isSafe: projectedEndOfMonth >= 0,
    ccLiability,
    totalPendingBankIncome: Math.round(totalPendingBankIncome),
    totalPendingBankExpenses: Math.round(totalPendingBankExpenses),
    dataPoints,
    pendingRecurring,
  };
}
