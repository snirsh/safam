import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { decrypt } from "@/lib/crypto/encryption";
import { scrapeOneZero } from "@/lib/scraper/one-zero";
import { scrapeIsracard } from "@/lib/scraper/isracard";
import { transformTransactions } from "@/lib/scraper/transform";
import { ingestTransactions, logScrapeError, type IngestResult } from "@/lib/scraper/ingest";
import { classifyTransactions } from "@/lib/classification/classify";
import { detectRecurringPatterns } from "@/lib/recurring/detect";
import type { OneZeroCredentials, IsracardCredentials, ScrapeResult } from "@/lib/scraper/types";

export const maxDuration = 60;

type AccountResult = { account: string; institution: string; status: string; added?: number };

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const accounts = await db
    .select({
      id: financialAccounts.id,
      institution: financialAccounts.institution,
      householdId: financialAccounts.householdId,
      encryptedCredentials: financialAccounts.encryptedCredentials,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.isActive, true),
        isNotNull(financialAccounts.encryptedCredentials),
      ),
    );

  if (accounts.length === 0) {
    return NextResponse.json({ message: "No active accounts", results: [] });
  }

  const results: AccountResult[] = [];
  // Collect newly inserted txns per household for post-response classification
  const householdInserts = new Map<string, IngestResult["newlyInserted"]>();

  for (const account of accounts) {
    const label = `${account.institution} (${account.id.slice(0, 8)}...)`;

    try {
      const credsJson = decrypt(account.encryptedCredentials!);
      const credentials = JSON.parse(credsJson) as Record<string, string>;

      let result: ScrapeResult;

      switch (account.institution) {
        case "one_zero":
          result = await scrapeOneZero(credentials as unknown as OneZeroCredentials);
          break;
        case "isracard":
          result = await scrapeIsracard(credentials as unknown as IsracardCredentials);
          break;
        default:
          results.push({ account: label, institution: account.institution, status: "unsupported" });
          continue;
      }

      if (!result.success) {
        await logScrapeError(account.id, result.error ?? "Unknown error");
        results.push({ account: label, institution: account.institution, status: `error: ${result.error}` });
        continue;
      }

      if (result.transactions.length === 0) {
        results.push({ account: label, institution: account.institution, status: "no_transactions" });
        continue;
      }

      const transformed = transformTransactions(result.transactions);
      const ingested = await ingestTransactions(account.id, account.householdId, transformed);

      if (ingested.newlyInserted.length > 0) {
        const existing = householdInserts.get(account.householdId) ?? [];
        existing.push(...ingested.newlyInserted);
        householdInserts.set(account.householdId, existing);
      }

      results.push({
        account: label,
        institution: account.institution,
        status: "success",
        added: ingested.added,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      try { await logScrapeError(account.id, msg); } catch { /* ignore */ }
      results.push({ account: label, institution: account.institution, status: `error: ${msg}` });
    }
  }

  // Run classification and recurring detection after response is sent
  if (householdInserts.size > 0) {
    after(async () => {
      for (const [householdId, newTxns] of householdInserts) {
        try {
          await classifyTransactions(householdId, newTxns);
          await detectRecurringPatterns(householdId);
        } catch (err) {
          console.error(`Post-scrape processing failed for ${householdId}:`, err);
        }
      }
    });
  }

  return NextResponse.json({ results });
}
