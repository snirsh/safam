import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { scrapeAccount } from "@/lib/scraper/runner";
import type { IngestResult } from "@/lib/scraper/ingest";
import { classifyTransactions } from "@/lib/classification/classify";
import { detectRecurringPatterns } from "@/lib/recurring/detect";

export const maxDuration = 120;

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
      lastSyncedAt: financialAccounts.lastSyncedAt,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.isActive, true),
        isNotNull(financialAccounts.encryptedCredentials),
      ),
    );

  console.log(`[cron/scrape] Found ${accounts.length} active accounts`);

  if (accounts.length === 0) {
    return NextResponse.json({ message: "No active accounts", results: [] });
  }

  const results: AccountResult[] = [];
  const householdInserts = new Map<string, IngestResult["newlyInserted"]>();

  for (const account of accounts) {
    const label = `${account.institution} (${account.id.slice(0, 8)}...)`;
    const result = await scrapeAccount({
      id: account.id,
      institution: account.institution,
      householdId: account.householdId,
      encryptedCredentials: account.encryptedCredentials!,
      lastSyncedAt: account.lastSyncedAt,
    });

    if (result.newlyInserted.length > 0) {
      const existing = householdInserts.get(account.householdId) ?? [];
      existing.push(...result.newlyInserted);
      householdInserts.set(account.householdId, existing);
    }

    results.push({
      account: label,
      institution: account.institution,
      status: result.status === "error" ? `error: ${result.error}` : result.status,
      added: result.added,
    });
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

  console.log(`[cron/scrape] Done. Results: ${JSON.stringify(results)}`);
  return NextResponse.json({ results });
}
