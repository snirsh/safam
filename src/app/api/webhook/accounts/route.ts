import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { validateWebhookKey } from "@/lib/webhook/auth";

/** Returns active accounts with encrypted credentials for the scraper. */
export async function GET(request: Request) {
  try {
    if (!validateWebhookKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await db
      .select({
        id: financialAccounts.id,
        institution: financialAccounts.institution,
        encryptedCredentials: financialAccounts.encryptedCredentials,
      })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.isActive, true),
          isNotNull(financialAccounts.encryptedCredentials),
        ),
      );

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("GET /api/webhook/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 },
    );
  }
}
