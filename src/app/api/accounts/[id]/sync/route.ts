import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { scrapeAccount } from "@/lib/scraper/runner";
import { classifyTransactions } from "@/lib/classification/classify";
import { detectRecurringPatterns } from "@/lib/recurring/detect";

export const maxDuration = 60;

/**
 * POST /api/accounts/[id]/sync
 * Manually trigger a scrape for a single account.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const [account] = await db
      .select({
        id: financialAccounts.id,
        institution: financialAccounts.institution,
        householdId: financialAccounts.householdId,
        encryptedCredentials: financialAccounts.encryptedCredentials,
        isActive: financialAccounts.isActive,
        lastSyncedAt: financialAccounts.lastSyncedAt,
      })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, id),
          eq(financialAccounts.householdId, session.householdId),
        ),
      );

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.encryptedCredentials) {
      return NextResponse.json(
        { error: "No credentials configured for this account" },
        { status: 400 },
      );
    }

    if (!account.isActive) {
      return NextResponse.json(
        { error: "Account is inactive. Activate it first." },
        { status: 400 },
      );
    }

    const result = await scrapeAccount({
      id: account.id,
      institution: account.institution,
      householdId: account.householdId,
      encryptedCredentials: account.encryptedCredentials,
      lastSyncedAt: account.lastSyncedAt,
    });

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.error ?? "Sync failed" },
        { status: 502 },
      );
    }

    // Run classification and recurring detection after response
    if (result.newlyInserted.length > 0) {
      after(async () => {
        try {
          await classifyTransactions(account.householdId, result.newlyInserted);
          await detectRecurringPatterns(account.householdId);
        } catch (err) {
          console.error(`Post-sync processing failed for ${account.householdId}:`, err);
        }
      });
    }

    return NextResponse.json({
      added: result.added,
      duplicates: result.duplicates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("POST /api/accounts/[id]/sync error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
