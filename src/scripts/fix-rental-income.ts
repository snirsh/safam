import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { transactions, categories, recurringPatterns } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function fixRentalIncome() {
  console.log("🔍 Finding Rental Income category...");

  // 1. Find the "Rental Income" category ID
  const rentalIncomeCategory = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.name, "Rental Income"))
    .limit(1);

  if (rentalIncomeCategory.length === 0) {
    throw new Error("❌ Rental Income category not found in database");
  }

  const category = rentalIncomeCategory[0]!;
  const categoryId = category.id;
  console.log(`✓ Found category: ${category.name} (${categoryId})`);

  // 2. Find transactions around 4,000₪ that are currently expenses
  console.log("\n🔍 Searching for ~4,000₪ expense transactions...");

  const candidates = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.transactionType, "expense"),
        sql`ABS(${transactions.amount} - 4000) < 200`, // Within 200₪ tolerance
      ),
    );

  console.log(`Found ${candidates.length} candidate transaction(s):`);
  for (const tx of candidates) {
    console.log(
      `  - ${tx.date.toISOString().slice(0, 10)}: ${tx.description} (${tx.amount}₪)`,
    );
  }

  if (candidates.length === 0) {
    console.log(
      "⚠️  No candidates found. You may need to adjust the search criteria.",
    );
    return;
  }

  // 3. Update transactions to income + Rental Income category
  console.log("\n📝 Updating transactions...");
  for (const tx of candidates) {
    await db
      .update(transactions)
      .set({
        transactionType: "income",
        categoryId: categoryId,
        isCategoryOverridden: true,
        classificationMethod: "manual",
      })
      .where(eq(transactions.id, tx.id));

    console.log(`  ✓ Updated: ${tx.description} → income + Rental Income`);
  }

  // 4. Find and update any recurring patterns
  console.log("\n🔍 Searching for recurring patterns around 4,000₪...");

  const patterns = await db
    .select()
    .from(recurringPatterns)
    .where(sql`ABS(${recurringPatterns.expectedAmount} - 4000) < 200`);

  console.log(`Found ${patterns.length} recurring pattern(s)`);

  for (const pattern of patterns) {
    await db
      .update(recurringPatterns)
      .set({ categoryId: categoryId })
      .where(eq(recurringPatterns.id, pattern.id));

    console.log(
      `  ✓ Updated pattern: ${pattern.description} (${pattern.expectedAmount}₪)`,
    );
  }

  console.log("\n✅ Rental income fix complete!");
}

fixRentalIncome()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
