/**
 * Test script for the Isracard scraper using production credentials.
 *
 * Uses the existing db module (auto-detects Neon vs local Postgres).
 * Point DATABASE_URL to your Neon production DB to test with real credentials.
 *
 * Usage:
 *   pnpm tsx scripts/test-isracard.ts
 *   pnpm tsx scripts/test-isracard.ts --full   # use 2-year lookback
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/index";
import { financialAccounts } from "../src/lib/db/schema";
import { decrypt } from "../src/lib/crypto/encryption";
import { scrapeIsracard } from "../src/lib/scraper/isracard";
import type { IsracardCredentials } from "../src/lib/scraper/types";

async function main() {
  const fullSync = process.argv.includes("--full");

  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");
  if (!process.env["ENCRYPTION_KEY"]) throw new Error("ENCRYPTION_KEY not set");

  console.log(`Connecting to database (${process.env["DATABASE_URL"]!.includes("neon.tech") ? "Neon" : "local"})...`);

  const [account] = await db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      encryptedCredentials: financialAccounts.encryptedCredentials,
      lastSyncedAt: financialAccounts.lastSyncedAt,
    })
    .from(financialAccounts)
    .where(eq(financialAccounts.institution, "isracard"))
    .limit(1);

  if (!account) {
    console.error("No Isracard account found in database");
    process.exit(1);
  }

  if (!account.encryptedCredentials) {
    console.error(`Account "${account.name}" has no credentials`);
    process.exit(1);
  }

  console.log(`Found account: ${account.name} (${account.id.slice(0, 8)}...)`);
  console.log(`Last synced: ${account.lastSyncedAt ?? "never"}`);

  const credsJson = decrypt(account.encryptedCredentials);
  const credentials = JSON.parse(credsJson) as IsracardCredentials;
  console.log(`Credentials decrypted (id: ${credentials.id.slice(0, 3)}***)`);

  let startDate: Date;
  if (fullSync) {
    startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    console.log(`Full sync mode: fetching from ${startDate.toISOString().slice(0, 10)}`);
  } else if (account.lastSyncedAt) {
    startDate = new Date(account.lastSyncedAt.getTime() - 24 * 60 * 60 * 1000);
    console.log(`Incremental sync: fetching from ${startDate.toISOString().slice(0, 10)}`);
  } else {
    startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    console.log(`First sync: fetching from ${startDate.toISOString().slice(0, 10)}`);
  }

  console.log("\nRunning Isracard scraper...\n");
  const t0 = performance.now();
  const result = await scrapeIsracard(credentials, startDate);
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

  if (!result.success) {
    console.error(`FAILED (${elapsed}s): ${result.error}`);
    process.exit(1);
  }

  console.log(`SUCCESS (${elapsed}s): ${result.transactions.length} transactions`);

  if (result.transactions.length > 0) {
    const first = result.transactions[0]!;
    const last = result.transactions[result.transactions.length - 1]!;
    console.log(`  Date range: ${first.date.slice(0, 10)} → ${last.date.slice(0, 10)}`);
    console.log(`\n  Sample transactions:`);
    for (const txn of result.transactions.slice(0, 5)) {
      console.log(`    ${txn.date.slice(0, 10)}  ${txn.chargedAmount.toFixed(2).padStart(10)} ILS  ${txn.description}`);
    }
    if (result.transactions.length > 5) {
      console.log(`    ... and ${result.transactions.length - 5} more`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
