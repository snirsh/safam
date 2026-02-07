import { createScraper } from "israeli-bank-scrapers";
import type { ScraperCredentials } from "israeli-bank-scrapers/lib/scrapers/interface.js";
import type { Transaction } from "israeli-bank-scrapers/lib/transactions.js";
import { INSTITUTION_TO_COMPANY } from "./config.js";

interface ScrapeResult {
  success: boolean;
  transactions: Transaction[];
  error?: string;
}

/** Scrape a single account. Returns transactions or error. */
export async function scrapeAccount(
  institution: string,
  credentials: Record<string, string>,
): Promise<ScrapeResult> {
  const companyId = INSTITUTION_TO_COMPANY[institution];
  if (!companyId) {
    return {
      success: false,
      transactions: [],
      error: `Unsupported institution: ${institution}`,
    };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const scraper = createScraper({
    companyId,
    startDate,
    combineInstallments: false,
    showBrowser: false,
  });

  // Credentials are dynamic from the DB — cast to the library's expected type
  const result = await scraper.scrape(credentials as ScraperCredentials);

  if (!result.success) {
    return {
      success: false,
      transactions: [],
      error: result.errorMessage ?? result.errorType ?? "Unknown scraper error",
    };
  }

  // Flatten all account transactions
  const allTxns: Transaction[] = [];
  if (result.accounts) {
    for (const account of result.accounts) {
      allTxns.push(...account.txns);
    }
  }

  return { success: true, transactions: allTxns };
}
