/**
 * Backfill existing bank account transactions that are CC payments
 * from "expense" to "transfer" to fix double-counting.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-transfers.ts           # dry run (default)
 *   pnpm tsx scripts/backfill-transfers.ts --apply    # actually update DB
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { transactions, financialAccounts } from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { isCreditCardPayment } from "../src/lib/scraper/transfer-detect";

async function main() {
  const apply = process.argv.includes("--apply");

  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");

  console.log(apply ? "MODE: APPLY (will update DB)" : "MODE: DRY RUN (preview only)");
  console.log("");

  // Get all bank accounts
  const bankAccounts = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(eq(financialAccounts.accountType, "bank"));

  console.log(`Found ${bankAccounts.length} bank account(s)\n`);

  let totalMatched = 0;
  let totalUpdated = 0;

  for (const account of bankAccounts) {
    const expenseTxns = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, account.id),
          eq(transactions.transactionType, "expense"),
        ),
      );

    const matches = expenseTxns.filter((tx) => isCreditCardPayment(tx.description));

    if (matches.length > 0) {
      console.log(`${account.name}: ${matches.length}/${expenseTxns.length} match CC payment patterns`);
      for (const tx of matches) {
        const dateStr = new Date(tx.date).toLocaleDateString("he-IL");
        console.log(`  ${dateStr}  ${tx.amount.padStart(10)}  ${tx.description}`);
      }

      if (apply) {
        for (const tx of matches) {
          await db
            .update(transactions)
            .set({ transactionType: "transfer", updatedAt: new Date() })
            .where(eq(transactions.id, tx.id));
        }
        totalUpdated += matches.length;
      }
    } else {
      console.log(`${account.name}: 0/${expenseTxns.length} matches`);
    }

    totalMatched += matches.length;
  }

  console.log(`\nTotal matched: ${totalMatched}`);
  if (apply) {
    console.log(`Total updated: ${totalUpdated}`);
  } else {
    console.log("Run with --apply to update these transactions.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
