import { db } from "@/lib/db";
import {
  transactions,
  recurringPatterns,
  categories,
} from "@/lib/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface ForecastDataPoint {
  date: string; // YYYY-MM-DD
  balance: number;
  label?: string;
}

export interface PendingRecurring {
  id: string;
  description: string;
  expectedAmount: number;
  expectedDate: string;
  type: "income" | "expense" | "transfer";
  categoryName: string | null;
  categoryIcon: string | null;
}

export interface ForecastResult {
  currentBalance: number;
  projectedEndOfMonth: number;
  dataPoints: ForecastDataPoint[];
  pendingRecurring: PendingRecurring[];
  totalPendingIncome: number;
  totalPendingExpenses: number;
}

/**
 * Calculate a balance projection for the rest of the current month.
 * Uses realized transactions + unfulfilled recurring patterns.
 */
export async function calculateForecast(
  householdId: string,
): Promise<ForecastResult> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Get current month's realized totals
  const totals = await db
    .select({
      type: transactions.transactionType,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        gte(transactions.date, monthStart),
        lt(transactions.date, monthEnd),
      ),
    )
    .groupBy(transactions.transactionType);

  const income = Number(totals.find((t) => t.type === "income")?.total ?? 0);
  const expenses = Math.abs(
    Number(totals.find((t) => t.type === "expense")?.total ?? 0),
  );
  const currentBalance = income - expenses;

  // Fetch active recurring patterns with category info
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
    })
    .from(recurringPatterns)
    .leftJoin(categories, eq(recurringPatterns.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(
      and(
        eq(recurringPatterns.householdId, householdId),
        eq(recurringPatterns.isActive, true),
      ),
    );

  // Get this month's transaction descriptions for fulfillment matching
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

  // Determine which patterns are still pending
  const pendingRecurring: PendingRecurring[] = [];

  for (const pattern of patterns) {
    const expectedAmt = Number(pattern.expectedAmount);
    const normalizedDesc = pattern.description.trim().toLowerCase();

    // Check if already fulfilled this month
    const fulfilled = monthDescriptions.some((t) => {
      const descMatch = t.desc.includes(normalizedDesc) || normalizedDesc.includes(t.desc);
      const amountTolerance = expectedAmt * 0.2;
      const amountMatch = Math.abs(t.amount - expectedAmt) <= amountTolerance;
      return descMatch && amountMatch;
    });

    if (fulfilled) continue;

    // Check if expected within current month
    const expectedDate = pattern.nextExpectedDate;
    if (!expectedDate) continue;

    // Only include if the expected date is within this month
    if (expectedDate < monthStart || expectedDate >= monthEnd) continue;

    // Only include if it is in the future (or today)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (expectedDate < today) continue;

    const isIncome = pattern.parentCategoryName === "Income";

    pendingRecurring.push({
      id: pattern.id,
      description: pattern.description,
      expectedAmount: expectedAmt,
      expectedDate: expectedDate.toISOString().slice(0, 10),
      type: isIncome ? "income" : "expense",
      categoryName: pattern.categoryName,
      categoryIcon: pattern.categoryIcon,
    });
  }

  // Build daily data points from today to end of month
  const dataPoints: ForecastDataPoint[] = [];
  let runningBalance = currentBalance;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(monthEnd.getTime() - 1); // last ms of current month

  for (
    let d = new Date(today);
    d <= lastDay;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);

    // Find pending recurring for this day
    const todaysPending = pendingRecurring.filter(
      (p) => p.expectedDate === dateStr,
    );

    for (const p of todaysPending) {
      if (p.type === "income") {
        runningBalance += p.expectedAmount;
      } else {
        runningBalance -= p.expectedAmount;
      }
    }

    const labelText = todaysPending.map((p) => p.description).join(", ");

    const point: ForecastDataPoint = {
      date: dateStr,
      balance: Math.round(runningBalance),
    };
    if (labelText) {
      point.label = labelText;
    }

    dataPoints.push(point);
  }

  const totalPendingIncome = pendingRecurring
    .filter((p) => p.type === "income")
    .reduce((sum, p) => sum + p.expectedAmount, 0);
  const totalPendingExpenses = pendingRecurring
    .filter((p) => p.type === "expense")
    .reduce((sum, p) => sum + p.expectedAmount, 0);

  const projectedEndOfMonth = dataPoints.length > 0
    ? dataPoints[dataPoints.length - 1]!.balance
    : currentBalance;

  return {
    currentBalance: Math.round(currentBalance),
    projectedEndOfMonth,
    dataPoints,
    pendingRecurring,
    totalPendingIncome: Math.round(totalPendingIncome),
    totalPendingExpenses: Math.round(totalPendingExpenses),
  };
}
