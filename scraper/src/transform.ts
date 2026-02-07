import { createHash } from "node:crypto";
import type { Transaction } from "israeli-bank-scrapers/lib/transactions.js";

interface WebhookTransaction {
  externalId: string;
  date: string;
  processedDate?: string;
  description: string;
  originalDescription?: string;
  amount: number;
  currency?: string;
  type: "income" | "expense";
  memo?: string;
}

/**
 * Generate a stable externalId for deduplication.
 * Uses the library's identifier if available, otherwise hashes key fields.
 */
function makeExternalId(tx: Transaction): string {
  if (tx.identifier !== undefined && tx.identifier !== null) {
    return String(tx.identifier);
  }
  // Fallback: hash of date + amount + description
  const raw = `${tx.date}|${tx.chargedAmount}|${tx.description}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** Transform library transactions to webhook payload format. */
export function transformTransactions(
  transactions: Transaction[],
): WebhookTransaction[] {
  return transactions.map((tx) => {
    const result: WebhookTransaction = {
      externalId: makeExternalId(tx),
      date: tx.date,
      description: tx.description,
      amount: Math.abs(tx.chargedAmount),
      type: tx.chargedAmount >= 0 ? "income" : "expense",
    };

    if (tx.processedDate) result.processedDate = tx.processedDate;
    if (tx.originalCurrency && tx.originalCurrency !== "ILS") {
      result.currency = tx.originalCurrency;
    }
    if (tx.memo) result.memo = tx.memo;

    return result;
  });
}
