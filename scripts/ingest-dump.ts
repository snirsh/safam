/**
 * Ingest a scraped transaction dump (JSON) into the production DB.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-dump.ts scripts/isracard-dump-2026-02-07.json
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { transformTransactions } from "../src/lib/scraper/transform";
import { ingestTransactions } from "../src/lib/scraper/ingest";
import type { RawTransaction } from "../src/lib/scraper/types";

interface DumpPayload {
  accountId: string;
  householdId: string;
  accountType?: "bank" | "credit_card";
  scrapedAt: string;
  startDate: string;
  count: number;
  transactions: RawTransaction[];
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm tsx scripts/ingest-dump.ts <path-to-dump.json>");
    process.exit(1);
  }

  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");
  if (!process.env["ENCRYPTION_KEY"]) throw new Error("ENCRYPTION_KEY not set");

  console.log(`Reading ${filePath}...`);
  const payload = JSON.parse(readFileSync(filePath, "utf-8")) as DumpPayload;

  console.log(`Account: ${payload.accountId}`);
  console.log(`Household: ${payload.householdId}`);
  console.log(`Transactions: ${payload.count}`);
  console.log(`Date range: ${payload.startDate.slice(0, 10)} → ${payload.scrapedAt.slice(0, 10)}`);

  console.log("\nTransforming...");
  const transformed = transformTransactions(payload.transactions, payload.accountType);
  console.log(`Transformed: ${transformed.length} transactions`);

  console.log("\nIngesting into DB...");
  const result = await ingestTransactions(payload.accountId, payload.householdId, transformed);

  console.log(`\nDone! Added: ${result.added}, Duplicates: ${result.duplicates}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
