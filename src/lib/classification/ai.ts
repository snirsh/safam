import { GoogleGenerativeAI } from "@google/generative-ai";

interface CategoryOption {
  id: string;
  name: string;
  parentName: string | null;
}

interface TransactionInput {
  id: string;
  description: string;
  amount: string;
  type: "income" | "expense";
}

interface AiClassification {
  transactionId: string;
  categoryId: string;
}

const MODEL_NAME = "gemini-2.0-flash";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Classify a batch of transactions using Gemini Flash.
 * Returns an array of transactionId → categoryId mappings.
 * Only returns valid mappings (category IDs that exist in the provided options).
 */
export async function classifyWithAi(
  txns: TransactionInput[],
  categoryOptions: CategoryOption[],
): Promise<AiClassification[]> {
  if (txns.length === 0) return [];

  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL_NAME });

  const categoryList = categoryOptions
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

Respond ONLY with a valid JSON array. Each element must have:
- "id": the transaction id (string)
- "categoryId": the chosen category id (string, must be from the list above)

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

If you cannot determine a category, use the "Other" parent category.
Do NOT include any text outside the JSON array.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/```json?\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed: unknown = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("AI response is not an array");
  }

  const validCategoryIds = new Set(categoryOptions.map((c) => c.id));
  const results: AiClassification[] = [];

  for (const item of parsed) {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "categoryId" in item &&
      typeof item.id === "string" &&
      typeof item.categoryId === "string" &&
      validCategoryIds.has(item.categoryId)
    ) {
      results.push({
        transactionId: item.id,
        categoryId: item.categoryId,
      });
    }
  }

  return results;
}
