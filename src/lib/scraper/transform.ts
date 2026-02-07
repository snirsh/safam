import { createHash } from "node:crypto";
import type { RawTransaction, TransformedTransaction } from "./types";

/**
 * Generate a stable externalId for deduplication.
 * Uses the scraper's identifier if available, otherwise hashes key fields.
 */
function makeExternalId(tx: RawTransaction): string {
  if (tx.identifier !== undefined && tx.identifier !== null) {
    return String(tx.identifier);
  }
  const raw = `${tx.date}|${tx.chargedAmount}|${tx.description}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** Transform raw scraper transactions to the format expected by ingest. */
export function transformTransactions(
  transactions: RawTransaction[],
): TransformedTransaction[] {
  return transactions.map((tx) => {
    const result: TransformedTransaction = {
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
