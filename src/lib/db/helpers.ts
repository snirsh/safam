import { sql } from "drizzle-orm";
import { transactions } from "./schema";

/**
 * SQL expression for the "effective date" of a transaction.
 *
 * Uses processedDate (billing date) when it exists AND falls within a
 * reasonable window around the purchase date (−7 … +45 days). This
 * prevents stale scraper data — where processedDate was set to the
 * scraper run-time instead of the actual billing date — from pulling
 * historical CC transactions into the wrong month.
 *
 * Falls back to the purchase date otherwise.
 */
export function effectiveDateExpr() {
  return sql`CASE
    WHEN ${transactions.processedDate} IS NOT NULL
      AND ${transactions.processedDate}
        BETWEEN ${transactions.date} - INTERVAL '7 days'
            AND ${transactions.date} + INTERVAL '45 days'
    THEN ${transactions.processedDate}
    ELSE ${transactions.date}
  END`;
}
