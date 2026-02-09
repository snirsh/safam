import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function revertWrongIncome() {
  console.log("\n🔄 Reverting incorrectly changed transactions...\n");

  // Find the two wrong transactions by exact descriptions
  const wrongOnes = await db
    .select()
    .from(transactions)
    .where(eq(transactions.description, "טלפון ני/VAND STAR/קניה"));

  const medical = await db
    .select()
    .from(transactions)
    .where(eq(transactions.description, "מרכז מומחים למלנומה"));

  const toRevert = [...wrongOnes, ...medical];

  console.log(`Found ${toRevert.length} transactions to revert:`);
  for (const tx of toRevert) {
    console.log(`  - ${tx.description} (₪${tx.amount})`);
  }

  if (toRevert.length === 0) {
    console.log("✓ No transactions to revert");
    return;
  }

  // Revert them back to expense
  console.log("\n📝 Reverting to expense...");

  for (const tx of toRevert) {
    await db
      .update(transactions)
      .set({
        transactionType: "expense",
        categoryId: null, // Clear category
        isCategoryOverridden: false,
        classificationMethod: "ai",
      })
      .where(eq(transactions.id, tx.id));

    console.log(`  ✓ Reverted: ${tx.description}`);
  }

  console.log("\n✅ Revert complete!");
}

revertWrongIncome()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
