import { createHash } from "node:crypto";
import type { RawTransaction, TransformedTransaction } from "./types";
import { isCreditCardPayment } from "./transfer-detect";

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
  accountType?: "bank" | "credit_card",
): TransformedTransaction[] {
  return transactions.map((tx) => {
    let type: "income" | "expense" | "transfer" =
      tx.chargedAmount >= 0 ? "income" : "expense";

    // On bank accounts, detect CC payment transfers to avoid double-counting
    if (type === "expense" && accountType === "bank" && isCreditCardPayment(tx.description)) {
      type = "transfer";
    }

    const result: TransformedTransaction = {
      externalId: makeExternalId(tx),
      date: tx.date,
      description: tx.description,
      amount: Math.abs(tx.chargedAmount),
      type,
    };

    if (tx.processedDate) result.processedDate = tx.processedDate;
    if (tx.originalCurrency && tx.originalCurrency !== "ILS") {
      result.currency = tx.originalCurrency;
    }
    if (tx.memo) result.memo = tx.memo;

    return result;
  });
}
