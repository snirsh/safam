import { decrypt } from "@/lib/crypto/encryption";
import { scrapeOneZero } from "./one-zero";
import { scrapeIsracard } from "./isracard";
import { transformTransactions } from "./transform";
import { ingestTransactions, logScrapeError, type IngestResult } from "./ingest";
import type { OneZeroCredentials, IsracardCredentials } from "./types";

export interface ScrapeAccountResult {
  status: string;
  added: number;
  duplicates: number;
  error?: string;
  newlyInserted: IngestResult["newlyInserted"];
}

/**
 * Run the full scrape pipeline for a single account:
 * decrypt credentials → call institution scraper → transform → ingest.
 */
export async function scrapeAccount(
  account: {
    id: string;
    institution: string;
    householdId: string;
    encryptedCredentials: string;
    lastSyncedAt: Date | null;
  },
  options?: { fullSync?: boolean },
): Promise<ScrapeAccountResult> {
  const label = `${account.institution} (${account.id.slice(0, 8)}...)`;

  try {
    const credsJson = decrypt(account.encryptedCredentials);
    const credentials = JSON.parse(credsJson) as Record<string, string>;

    // Incremental: lastSyncedAt - 1 day overlap. First/full: 30 days max.
    // For bulk historical loads, use the local scrape + ingest-dump scripts.
    let startDate: Date;
    if (!options?.fullSync && account.lastSyncedAt) {
      startDate = new Date(account.lastSyncedAt.getTime() - 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const result = await (async () => {
      switch (account.institution) {
        case "one_zero":
          return scrapeOneZero(credentials as unknown as OneZeroCredentials, startDate);
        case "isracard":
          return scrapeIsracard(credentials as unknown as IsracardCredentials, startDate);
        default:
          return { success: false, transactions: [], error: `Unsupported institution: ${account.institution}` } as const;
      }
    })();

    if (!result.success) {
      console.error(`[scraper] ${label}: error — ${result.error}`);
      await logScrapeError(account.id, result.error ?? "Unknown error");
      const base = { status: "error" as const, added: 0, duplicates: 0, newlyInserted: [] as IngestResult["newlyInserted"] };
      if (result.error) return { ...base, error: result.error };
      return base;
    }

    console.log(`[scraper] ${label}: scraped ${result.transactions.length} transactions`);

    if (result.transactions.length === 0) {
      // 0 transactions with success is legitimate — log as success, not error
      const ingested = await ingestTransactions(account.id, account.householdId, []);
      return { status: "success", added: 0, duplicates: 0, newlyInserted: ingested.newlyInserted };
    }

    const transformed = transformTransactions(result.transactions);
    const ingested = await ingestTransactions(account.id, account.householdId, transformed);

    console.log(`[scraper] ${label}: added=${ingested.added} duplicates=${ingested.duplicates}`);

    return {
      status: "success",
      added: ingested.added,
      duplicates: ingested.duplicates,
      newlyInserted: ingested.newlyInserted,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error(`[scraper] ${label}: unhandled error — ${msg}`);
    try { await logScrapeError(account.id, msg); } catch { /* ignore */ }
    return { status: "error", added: 0, duplicates: 0, error: msg, newlyInserted: [] };
  }
}
