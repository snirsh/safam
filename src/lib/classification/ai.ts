import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { filterCategoriesByDirection } from "./category-direction";

type CategoryOption = {
  id: string;
  name: string;
  parentName: string | null;
};

type TransactionInput = {
  id: string;
  description: string;
  amount: string;
  type: "income" | "expense" | "transfer";
};

interface AiClassification {
  transactionId: string;
  categoryId: string;
}

const classificationSchema = z.object({
  classifications: z.array(
    z.object({
      id: z.string().describe("The transaction id"),
      categoryId: z
        .string()
        .describe("The chosen category id from the provided list"),
    }),
  ),
});

/**
 * Classify a batch of transactions using Gemini Flash via Vercel AI Gateway.
 * Returns an array of transactionId → categoryId mappings.
 * Only returns valid mappings (category IDs that exist in the provided options).
 */
export async function classifyWithAi(
  txns: TransactionInput[],
  categoryOptions: CategoryOption[],
): Promise<AiClassification[]> {
  if (txns.length === 0) return [];

  // Determine dominant transaction type to filter categories by direction.
  // If mixed types, use all categories (post-hoc direction guard in classify.ts handles it).
  const types = new Set(txns.map((t) => t.type));
  const filteredCategories =
    types.size === 1
      ? filterCategoriesByDirection(txns[0]!.type, categoryOptions)
      : categoryOptions;

  const categoryList = filteredCategories
    .map((c) => {
      const label = c.parentName ? `${c.parentName} > ${c.name}` : c.name;
      return `  "${c.id}": "${label}"`;
    })
    .join("\n");

  const txnList = txns
    .map(
      (t) =>
        `  { "id": "${t.id}", "desc": "${t.description.replace(/"/g, '\\"')}", "amount": ${t.amount}, "type": "${t.type}" }`,
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

  const { object } = await generateObject({
    model: gateway("google/gemini-2.0-flash"),
    schema: classificationSchema,
    prompt,
  });

  // Post-validation: filter to only category IDs that exist in the direction-filtered set
  const validCategoryIds = new Set(filteredCategories.map((c) => c.id));
  const results: AiClassification[] = [];

  for (const item of object.classifications) {
    if (validCategoryIds.has(item.categoryId)) {
      results.push({
        transactionId: item.id,
        categoryId: item.categoryId,
      });
    }
  }

  return results;
}
