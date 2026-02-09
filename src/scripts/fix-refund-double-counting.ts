import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { transactions, financialAccounts } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function fixRefundDoubleCount() {
  console.log("\n🔍 Finding refund double-counts...\n");

  // Get bank account ID
  const bankAccount = await db
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.institution, "one_zero"))
    .limit(1);

  if (bankAccount.length === 0) {
    throw new Error("❌ Bank account not found");
  }

  const bankId = bankAccount[0]!.id;

  // Find bank transactions that might be CC refunds
  // Looking for: income transactions in bank with "החזר" (refund) in description
  const candidates = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, bankId),
        eq(transactions.transactionType, "income"),
        sql`${transactions.description} LIKE '%החזר%'
            OR ${transactions.description} LIKE '%REFUND%'
            OR ${transactions.description} LIKE '%זיכוי%'`,
      ),
    );

  console.log(`Found ${candidates.length} potential refund deposits:`);
  for (const tx of candidates) {
    console.log(
      `  - ${tx.date.toISOString().slice(0, 10)}: ${tx.description} (₪${tx.amount})`,
    );
  }

  if (candidates.length === 0) {
    console.log("✓ No refund double-counts found");
    return;
  }

  // Mark them as transfers
  console.log("\n📝 Marking as transfers to avoid double-counting...");

  for (const tx of candidates) {
    await db
      .update(transactions)
      .set({ transactionType: "transfer" })
      .where(eq(transactions.id, tx.id));

    console.log(`  ✓ Marked as transfer: ${tx.description}`);
  }

  console.log("\n✅ Refund fix complete!");
}

fixRefundDoubleCount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
