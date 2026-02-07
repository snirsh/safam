import { db } from "@/lib/db";
import { financialAccounts, transactions, syncLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto/encryption";
import type { TransformedTransaction } from "./types";

export interface IngestResult {
  added: number;
  duplicates: number;
  /** Newly inserted transaction IDs + metadata for classification. */
  newlyInserted: Array<{
    id: string;
    description: string;
    amount: string;
    transactionType: "income" | "expense";
  }>;
}

/** Insert scraped transactions into the DB. Handles deduplication and sync logging. */
export async function ingestTransactions(
  accountId: string,
  householdId: string,
  txns: TransformedTransaction[],
): Promise<IngestResult> {
  const startedAt = new Date();
  let added = 0;
  let duplicates = 0;
  const newlyInserted: IngestResult["newlyInserted"] = [];

  for (const tx of txns) {
    try {
      const encryptedPayload = encrypt(JSON.stringify(tx));

      const result = await db
        .insert(transactions)
        .values({
          householdId,
          accountId,
          externalId: tx.externalId,
          date: new Date(tx.date),
          processedDate: tx.processedDate ? new Date(tx.processedDate) : null,
          description: tx.description,
          originalDescription: tx.originalDescription ?? null,
          amount: tx.amount.toString(),
          currency: tx.currency ?? "ILS",
          transactionType: tx.type,
          encryptedRawPayload: encryptedPayload,
          memo: tx.memo ?? null,
        })
        .onConflictDoNothing({
          target: [transactions.accountId, transactions.externalId],
        })
        .returning({ id: transactions.id });

      if (result.length > 0) {
        added++;
        const inserted = result[0];
        if (inserted) {
          newlyInserted.push({
            id: inserted.id,
            description: tx.description,
            amount: tx.amount.toString(),
            transactionType: tx.type,
          });
        }
      } else {
        duplicates++;
      }
    } catch (err) {
      console.error(`[ingest] Failed to insert tx ${tx.externalId}:`, err);
      duplicates++;
    }
  }

  // Update account lastSyncedAt
  await db
    .update(financialAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(financialAccounts.id, accountId));

  // Create sync log
  await db.insert(syncLogs).values({
    accountId,
    status: "success",
    transactionsAdded: added,
    transactionsDuplicate: duplicates,
    startedAt,
    completedAt: new Date(),
  });

  return { added, duplicates, newlyInserted };
}

/** Log a failed scrape attempt. */
export async function logScrapeError(
  accountId: string,
  error: string,
): Promise<void> {
  const now = new Date();
  await db.insert(syncLogs).values({
    accountId,
    status: "error",
    transactionsAdded: 0,
    transactionsDuplicate: 0,
    errorMessage: error,
    startedAt: now,
    completedAt: now,
  });
}
