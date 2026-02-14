import { db } from "@/lib/db";
import { transactions, recurringPatterns, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  median,
  standardDeviation,
  daysToFrequency,
  frequencyToDays,
  mode,
} from "./intervals";
import type { Frequency } from "./intervals";
import { isCategoryDirectionCompatible } from "@/lib/classification/category-direction";

interface DetectionResult {
  detected: number;
  updated: number;
}

interface TxRow {
  description: string;
  amount: string;
  date: Date;
  categoryId: string | null;
  accountId: string;
  transactionType: "income" | "expense" | "transfer";
}

const DEFAULT_MIN_OCCURRENCES = 3;
const LOW_FREQ_MIN_OCCURRENCES = 2; // semi_annual/yearly need fewer samples
const MIN_CONFIDENCE = 0.7;

function getMinOccurrences(frequency: Frequency): number {
  if (frequency === "semi_annual" || frequency === "yearly") {
    return LOW_FREQ_MIN_OCCURRENCES;
  }
  return DEFAULT_MIN_OCCURRENCES;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(
    (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Detect recurring patterns from transaction history.
 * Groups by normalized description, analyzes intervals,
 * and upserts into recurringPatterns table.
 */
export async function detectRecurringPatterns(
  householdId: string,
): Promise<DetectionResult> {
  // Load categories with parent names for direction guard
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(eq(categories.householdId, householdId));

  const parentNameMap = new Map<string, string>();
  for (const cat of allCategories) {
    if (!cat.parentId) {
      parentNameMap.set(cat.id, cat.name);
    }
  }

  const categoryOptions = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    parentName: c.parentId ? (parentNameMap.get(c.parentId) ?? null) : null,
  }));

  // Fetch last 12 months of transactions
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);

  const txns = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      date: transactions.date,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      transactionType: transactions.transactionType,
    })
    .from(transactions)
    .where(
      sql`${transactions.householdId} = ${householdId} AND ${transactions.date} >= ${cutoff} AND ${transactions.transactionType} != 'transfer'`,
    )
    .orderBy(transactions.date);

  // Group by normalized description
  const groups = new Map<string, TxRow[]>();
  for (const tx of txns) {
    const key = tx.description.trim().toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(tx);
    } else {
      groups.set(key, [tx]);
    }
  }

  let detected = 0;
  let updated = 0;

  for (const [, group] of groups) {
    // Need at least 2 transactions to compute any interval
    if (group.length < LOW_FREQ_MIN_OCCURRENCES) continue;

    // Sort by date ascending
    group.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      intervals.push(daysBetween(group[i]!.date, group[i - 1]!.date));
    }

    if (intervals.length === 0) continue;

    const medianInterval = median(intervals);
    const frequency = daysToFrequency(medianInterval);
    if (!frequency) continue;

    // Check frequency-aware minimum (e.g., semi_annual only needs 2)
    if (group.length < getMinOccurrences(frequency)) continue;

    // Calculate confidence
    const expectedDays = frequencyToDays[frequency];
    const stddev = standardDeviation(intervals);
    const consistency = Math.max(0, Math.min(1, 1 - stddev / expectedDays));
    const countScore = Math.min(group.length / 6, 1);
    const lastDate = group[group.length - 1]!.date;
    const daysSinceLast = daysBetween(new Date(), lastDate);
    const recency =
      daysSinceLast <= expectedDays * 2
        ? 1
        : Math.max(0, 1 - (daysSinceLast - expectedDays * 2) / expectedDays);

    const confidence = 0.5 * consistency + 0.25 * countScore + 0.25 * recency;
    if (confidence < MIN_CONFIDENCE) continue;

    // Compute expected amount (median), category (mode), account (mode)
    const amounts = group.map((t) => Math.abs(Number(t.amount)));
    const expectedAmount = median(amounts);

    // Direction-aware category mode: filter candidates to match the group's transaction type
    const dominantType = mode(group.map((t) => t.transactionType)) ?? "expense";
    const categoryIds = group
      .map((t) => t.categoryId)
      .filter((id): id is string => id !== null)
      .filter((id) =>
        isCategoryDirectionCompatible(dominantType, id, categoryOptions),
      );
    const categoryId = mode(categoryIds);
    const accountId = mode(group.map((t) => t.accountId));

    // Compute next expected date
    const nextExpectedDate = new Date(lastDate);
    nextExpectedDate.setDate(nextExpectedDate.getDate() + expectedDays);

    // Use the original (non-normalized) description from the most recent transaction
    const description = group[group.length - 1]!.description;

    // Upsert
    const result = await db
      .insert(recurringPatterns)
      .values({
        householdId,
        description,
        expectedAmount: expectedAmount.toFixed(2),
        frequency,
        categoryId: categoryId ?? undefined,
        accountId: accountId ?? undefined,
        lastOccurrence: lastDate,
        nextExpectedDate,
        confidence: confidence.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [recurringPatterns.householdId, recurringPatterns.description],
        set: {
          expectedAmount: expectedAmount.toFixed(2),
          frequency,
          categoryId: categoryId ?? null,
          accountId: accountId ?? null,
          lastOccurrence: lastDate,
          nextExpectedDate,
          confidence: confidence.toFixed(2),
          updatedAt: new Date(),
        },
      })
      .returning({ id: recurringPatterns.id, createdAt: recurringPatterns.createdAt, updatedAt: recurringPatterns.updatedAt });

    if (result[0]) {
      // If createdAt ~= updatedAt (within 1 second), it's a new insert
      const r = result[0];
      const isNew = Math.abs(r.createdAt.getTime() - r.updatedAt.getTime()) < 1000;
      if (isNew) {
        detected++;
      } else {
        updated++;
      }
    }
  }

  return { detected, updated };
}
