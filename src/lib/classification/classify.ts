import { db } from "@/lib/db";
import {
  transactions,
  categories,
  categorizationRules,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { matchRule, type CategorizationRule } from "./rules";
import { classifyWithAi } from "./ai";

interface NewTransaction {
  id: string;
  description: string;
  amount: string;
  transactionType: "income" | "expense";
}

/**
 * Classify a batch of newly inserted transactions.
 * Two-tier: rules first, then Gemini Flash for unmatched.
 * Fire-and-forget safe — all errors are caught and logged.
 */
export async function classifyTransactions(
  householdId: string,
  newTxns: NewTransaction[],
): Promise<void> {
  if (newTxns.length === 0) return;

  // --- Tier 1: Rule-based classification ---
  let rules: CategorizationRule[];
  try {
    rules = await db
      .select({
        pattern: categorizationRules.pattern,
        categoryId: categorizationRules.categoryId,
        priority: categorizationRules.priority,
      })
      .from(categorizationRules)
      .where(eq(categorizationRules.householdId, householdId))
      .orderBy(sql`${categorizationRules.priority} DESC`);
  } catch (error) {
    console.error("Failed to fetch categorization rules:", error);
    rules = [];
  }

  const unmatched: NewTransaction[] = [];

  for (const tx of newTxns) {
    const match = matchRule(rules, tx.description);
    if (match) {
      try {
        await db
          .update(transactions)
          .set({
            categoryId: match.categoryId,
            classificationMethod: "rule",
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));
      } catch (error) {
        console.error(`Rule update failed for tx ${tx.id}:`, error);
      }
    } else {
      unmatched.push(tx);
    }
  }

  if (unmatched.length === 0) return;

  // --- Tier 2: AI classification (Gemini Flash) ---
  if (!process.env["GOOGLE_GENERATIVE_AI_API_KEY"]) {
    console.warn(
      "GOOGLE_GENERATIVE_AI_API_KEY not set, skipping AI classification",
    );
    return;
  }

  let categoryOptions: { id: string; name: string; parentName: string | null }[];
  try {
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
      if (!cat.parentId) {
        parentNameMap.set(cat.id, cat.name);
      }
    }

    categoryOptions = allCategories.map((c) => ({
      id: c.id,
      name: c.name,
      parentName: c.parentId ? (parentNameMap.get(c.parentId) ?? null) : null,
    }));
  } catch (error) {
    console.error("Failed to fetch categories for AI classification:", error);
    return;
  }

  // Batch into chunks of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < unmatched.length; i += BATCH_SIZE) {
    const batch = unmatched.slice(i, i + BATCH_SIZE);
    try {
      const results = await classifyWithAi(
        batch.map((tx) => ({
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          type: tx.transactionType,
        })),
        categoryOptions,
      );

      for (const result of results) {
        try {
          await db
            .update(transactions)
            .set({
              categoryId: result.categoryId,
              classificationMethod: "ai",
              updatedAt: new Date(),
            })
            .where(eq(transactions.id, result.transactionId));
        } catch (updateError) {
          console.error(
            `AI update failed for tx ${result.transactionId}:`,
            updateError,
          );
        }
      }
    } catch (batchError) {
      console.error(
        `AI classification batch failed (offset ${i}):`,
        batchError,
      );
    }
  }
}
