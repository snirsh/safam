import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function setStartingBalance() {
  // Find the ONE Zero bank account
  const accounts = await db
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.institution, "one_zero"));

  if (accounts.length === 0) {
    throw new Error("❌ ONE Zero account not found");
  }

  const account = accounts[0]!;
  console.log(`\n📍 Found account: ${account.name} (${account.institution})`);

  // Set starting balance to -15,609.57
  const startingBalance = -15609.57;

  await db
    .update(financialAccounts)
    .set({ startingBalance: startingBalance.toString() })
    .where(eq(financialAccounts.id, account.id));

  console.log(`✓ Set starting balance to ₪${startingBalance.toFixed(2)}`);
  console.log("\n✅ Starting balance updated!");
}

setStartingBalance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
