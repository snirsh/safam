/**
 * Bulk-classify uncategorized transactions efficiently.
 *
 * Deduplicates by description first so we only call Gemini once per
 * unique description, then bulk-applies results + creates rules.
 *
 * Usage:
 *   pnpm tsx scripts/bulk-classify.ts            # run for real
 *   pnpm tsx scripts/bulk-classify.ts --dry-run   # preview only
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  transactions,
  categories,
  categorizationRules,
} from "../src/lib/db/schema";
import { matchRule, type CategorizationRule } from "../src/lib/classification/rules";

const dryRun = process.argv.includes("--dry-run");

// ─── Types ───────────────────────────────────────────────

interface DescriptionGroup {
  original: string; // first-seen casing for rule creation
  txnIds: string[];
  representativeAmount: string;
  mostCommonType: "income" | "expense" | "transfer";
}

// ─── AI batch schema (same structure as ai.ts) ──────────

const classificationSchema = z.object({
  classifications: z.array(
    z.object({
      id: z.string().describe("The description id"),
      categoryId: z
        .string()
        .describe("The chosen category id from the provided list"),
    }),
  ),
});

// ─── Main ────────────────────────────────────────────────

async function main() {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");

  if (dryRun) console.log("=== DRY RUN MODE (no DB changes) ===\n");

  // 1. Fetch all uncategorized transactions
  console.log("Fetching uncategorized transactions...");
  const uncategorized = await db
    .select({
      id: transactions.id,
      householdId: transactions.householdId,
      description: transactions.description,
      amount: transactions.amount,
      transactionType: transactions.transactionType,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.categoryId),
        eq(transactions.isCategoryOverridden, false),
      ),
    );

  // Filter out transfers (CC payments don't need classification)
  const classifiable = uncategorized.filter((tx) => tx.transactionType !== "transfer");

  console.log(`Found ${uncategorized.length} uncategorized (${uncategorized.length - classifiable.length} transfers skipped)`);

  if (classifiable.length === 0) {
    console.log("No classifiable transactions found. Done!");
    return;
  }

  // 2. Group by householdId (in case there are multiple)
  const byHousehold = new Map<string, typeof classifiable>();
  for (const tx of classifiable) {
    const list = byHousehold.get(tx.householdId) ?? [];
    list.push(tx);
    byHousehold.set(tx.householdId, list);
  }

  console.log(`Classifiable: ${classifiable.length} transactions across ${byHousehold.size} household(s)\n`);

  for (const [householdId, txns] of byHousehold) {
    await processHousehold(householdId, txns);
  }
}

async function processHousehold(
  householdId: string,
  txns: Array<{
    id: string;
    description: string;
    amount: string;
    transactionType: "income" | "expense" | "transfer";
  }>,
) {
  console.log(`── Household ${householdId.slice(0, 8)}... (${txns.length} txns) ──`);

  // 3. Deduplicate by lowercase description
  const groups = new Map<string, DescriptionGroup>();
  for (const tx of txns) {
    const key = tx.description.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.txnIds.push(tx.id);
    } else {
      groups.set(key, {
        original: tx.description,
        txnIds: [tx.id],
        representativeAmount: tx.amount,
        mostCommonType: tx.transactionType,
      });
    }
  }

  console.log(`  Unique descriptions: ${groups.size} (from ${txns.length} transactions)`);
  console.log(`  Dedup savings: ${((1 - groups.size / txns.length) * 100).toFixed(0)}% fewer API items\n`);

  // 4. Tier 1: Rule-based matching
  console.log("  Tier 1: Applying existing rules...");
  const rules: CategorizationRule[] = await db
    .select({
      pattern: categorizationRules.pattern,
      categoryId: categorizationRules.categoryId,
      priority: categorizationRules.priority,
    })
    .from(categorizationRules)
    .where(eq(categorizationRules.householdId, householdId))
    .orderBy(sql`${categorizationRules.priority} DESC`);

  let ruleMatched = 0;
  let ruleMatchedTxns = 0;
  const unmatched = new Map<string, DescriptionGroup>();

  for (const [key, group] of groups) {
    const match = matchRule(rules, group.original);
    if (match) {
      ruleMatched++;
      ruleMatchedTxns += group.txnIds.length;
      if (!dryRun) {
        await db
          .update(transactions)
          .set({
            categoryId: match.categoryId,
            classificationMethod: "rule",
            updatedAt: new Date(),
          })
          .where(inArray(transactions.id, group.txnIds));
      }
    } else {
      unmatched.set(key, group);
    }
  }

  console.log(`  Rules matched: ${ruleMatched} descriptions (${ruleMatchedTxns} transactions)`);

  if (unmatched.size === 0) {
    console.log("  All matched by rules. Done!\n");
    return;
  }

  // 5. Tier 2: AI classification on unique descriptions
  if (!process.env["AI_GATEWAY_API_KEY"] && !process.env["VERCEL_OIDC_TOKEN"]) {
    console.warn("  AI_GATEWAY_API_KEY not set, skipping AI classification");
    return;
  }

  console.log(`\n  Tier 2: AI classifying ${unmatched.size} unique descriptions...`);

  // Fetch categories
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(eq(categories.householdId, householdId));

  const parentNameMap = new Map<string, string>();
  for (const cat of allCategories) {
    if (!cat.parentId) parentNameMap.set(cat.id, cat.name);
  }

  const categoryOptions = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    parentName: c.parentId ? (parentNameMap.get(c.parentId) ?? null) : null,
  }));

  const categoryList = categoryOptions
    .map((c) => {
      const label = c.parentName ? `${c.parentName} > ${c.name}` : c.name;
      return `  "${c.id}": "${label}"`;
    })
    .join("\n");

  const validCategoryIds = new Set(categoryOptions.map((c) => c.id));

  // Build description list with synthetic IDs
  const descEntries = [...unmatched.entries()].map(([, group], i) => ({
    synthId: `d${i}`,
    group,
  }));

  // Batch into chunks of 50
  const BATCH_SIZE = 50;
  let aiClassified = 0;
  let aiClassifiedTxns = 0;
  let rulesCreated = 0;
  let apiCalls = 0;

  for (let i = 0; i < descEntries.length; i += BATCH_SIZE) {
    const batch = descEntries.slice(i, i + BATCH_SIZE);
    apiCalls++;

    const txnList = batch
      .map(
        (e) =>
          `  { "id": "${e.synthId}", "desc": "${e.group.original.replace(/"/g, '\\"')}", "amount": ${e.group.representativeAmount}, "type": "${e.group.mostCommonType}" }`,
      )
      .join(",\n");

    const prompt = `You are a transaction categorizer for an Israeli family budget app.
Given bank transaction descriptions (mostly in Hebrew) and a list of available categories, assign the most appropriate category to each transaction.

Available categories (id: "Parent > Subcategory"):
{
${categoryList}
}

Transactions to classify:
[
${txnList}
]

Pick subcategories when possible (e.g., "Groceries" not "Food").
For Hebrew descriptions, use your knowledge of Israeli businesses:
- סופר/שופרסל/רמי לוי/מגה = Groceries
- סונול/פז/דלק = Fuel
- ארומה/קפה גרג = Coffee & Cafes
- וולט/וואלה!שף = Delivery
- Netflix/Spotify = Streaming
- חברת החשמל = Electricity
- מקורות = Water
- בזק/פרטנר/סלקום = Internet/Phone

If you cannot determine a category, use the "Other" parent category.`;

    console.log(`  API call ${apiCalls}: classifying ${batch.length} descriptions...`);

    if (dryRun) {
      console.log(`  [dry-run] Would send ${batch.length} descriptions to Gemini`);
      continue;
    }

    try {
      const { object } = await generateObject({
        model: gateway("google/gemini-2.0-flash"),
        schema: classificationSchema,
        prompt,
      });

      // Map synthetic ID back to description group
      const synthMap = new Map(batch.map((e) => [e.synthId, e.group]));

      for (const item of object.classifications) {
        if (!validCategoryIds.has(item.categoryId)) continue;

        const group = synthMap.get(item.id);
        if (!group) continue;

        aiClassified++;
        aiClassifiedTxns += group.txnIds.length;

        // Bulk-update all transactions with this description
        await db
          .update(transactions)
          .set({
            categoryId: item.categoryId,
            classificationMethod: "ai",
            updatedAt: new Date(),
          })
          .where(inArray(transactions.id, group.txnIds));

        // Create categorization rule
        try {
          await db
            .insert(categorizationRules)
            .values({
              householdId,
              pattern: group.original,
              categoryId: item.categoryId,
              priority: 0,
            })
            .onConflictDoUpdate({
              target: [
                categorizationRules.householdId,
                categorizationRules.pattern,
              ],
              set: { categoryId: item.categoryId },
            });
          rulesCreated++;
        } catch (ruleErr) {
          console.error(`  Rule creation failed for "${group.original}":`, ruleErr);
        }
      }
    } catch (batchErr) {
      console.error(`  AI batch ${apiCalls} failed:`, batchErr);
    }
  }

  // 6. Report
  console.log(`\n  ── Results ──`);
  console.log(`  Rule-matched:  ${ruleMatched} descriptions → ${ruleMatchedTxns} transactions`);
  console.log(`  AI-classified: ${aiClassified} descriptions → ${aiClassifiedTxns} transactions`);
  console.log(`  Rules created: ${rulesCreated}`);
  console.log(`  API calls:     ${apiCalls}`);
  console.log(`  Total:         ${ruleMatchedTxns + aiClassifiedTxns}/${txns.length} transactions categorized\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
