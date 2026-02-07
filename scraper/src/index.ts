import { getRequiredEnv } from "./config.js";
import { decrypt } from "./crypto.js";
import { fetchAccounts, pushTransactions } from "./api-client.js";
import { scrapeAccount } from "./scrape-account.js";
import { transformTransactions } from "./transform.js";

async function main() {
  // Validate required env vars upfront
  const encryptionKey = getRequiredEnv("ENCRYPTION_KEY");
  getRequiredEnv("WEBHOOK_URL");
  getRequiredEnv("WEBHOOK_API_KEY");

  console.log("Fetching active accounts...");
  const accounts = await fetchAccounts();

  if (accounts.length === 0) {
    console.log("No active accounts with credentials found. Exiting.");
    return;
  }

  console.log(`Found ${accounts.length} account(s) to scrape.`);

  let successCount = 0;
  let failCount = 0;

  for (const account of accounts) {
    const label = `${account.institution} (${account.id.slice(0, 8)}...)`;
    console.log(`\n--- Scraping ${label} ---`);

    try {
      // Decrypt credentials
      const credsJson = decrypt(account.encryptedCredentials, encryptionKey);
      const credentials = JSON.parse(credsJson) as Record<string, string>;

      // Scrape
      const result = await scrapeAccount(account.institution, credentials);

      if (!result.success) {
        console.error(`  Scrape failed: ${result.error}`);
        failCount++;
        continue;
      }

      console.log(
        `  Scraped ${result.transactions.length} transaction(s).`,
      );

      if (result.transactions.length === 0) {
        console.log("  No transactions to push.");
        successCount++;
        continue;
      }

      // Transform and push
      const webhookTxns = transformTransactions(result.transactions);
      const pushResult = await pushTransactions(account.id, webhookTxns);

      console.log(
        `  Pushed: ${pushResult.added} added, ${pushResult.duplicates} duplicates.`,
      );
      successCount++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`  Error: ${message}`);
      failCount++;
    }
  }

  console.log(
    `\nDone. ${successCount} succeeded, ${failCount} failed out of ${accounts.length}.`,
  );

  if (failCount > 0 && successCount === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
