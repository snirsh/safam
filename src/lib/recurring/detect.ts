import { db } from "@/lib/db";
import { transactions, recurringPatterns } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import {
  median,
  standardDeviation,
  daysToFrequency,
  frequencyToDays,
  mode,
} from "./intervals";

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
  transactionType: "income" | "expense";
}

const MIN_OCCURRENCES = 3;
const MIN_CONFIDENCE = 0.7;

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
      sql`${transactions.householdId} = ${householdId} AND ${transactions.date} >= ${cutoff}`,
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
    if (group.length < MIN_OCCURRENCES) continue;

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
    const categoryIds = group
      .map((t) => t.categoryId)
      .filter((id): id is string => id !== null);
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
