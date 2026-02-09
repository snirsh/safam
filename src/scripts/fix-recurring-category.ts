import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { recurringPatterns, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function fixRecurringCategory() {
  console.log("\n🔍 Finding Rental Income category...");

  // Get Rental Income category
  const rentalCat = await db
    .select()
    .from(categories)
    .where(eq(categories.name, "Rental Income"))
    .limit(1);

  if (rentalCat.length === 0) {
    throw new Error("❌ Rental Income category not found");
  }

  const category = rentalCat[0]!;
  console.log(`✓ Found: ${category.name} (${category.id})`);

  // Find the 4,000₪ recurring pattern
  const pattern = await db
    .select()
    .from(recurringPatterns)
    .where(sql`ABS(${recurringPatterns.expectedAmount} - 4000) < 10`);

  if (pattern.length === 0) {
    throw new Error("❌ 4,000₪ recurring pattern not found");
  }

  console.log(`\n📋 Found ${pattern.length} pattern(s):`);
  for (const p of pattern) {
    console.log(`  - ${p.description} (₪${p.expectedAmount})`);
  }

  // Update category for all matching patterns
  for (const p of pattern) {
    await db
      .update(recurringPatterns)
      .set({ categoryId: category.id })
      .where(eq(recurringPatterns.id, p.id));

    console.log(`\n✓ Updated category to: ${category.name}`);
  }

  console.log("\n✅ Category fix complete!");
}

fixRecurringCategory()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
