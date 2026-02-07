import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto/encryption";
import { verifyOtp, validateCredentials } from "@/lib/scraper/one-zero";

/**
 * POST /api/accounts/[id]/otp/verify
 * Verifies OTP code, obtains long-term token, stores it encrypted.
 * Body: { otpCode: string }
 * Returns: { success: true } when token is stored and account is ready for scraping.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = (await request.json()) as { otpCode?: string };

    if (!body.otpCode) {
      return NextResponse.json(
        { error: "otpCode is required" },
        { status: 400 },
      );
    }

    // Fetch account with pending OTP state
    const [account] = await db
      .select({
        id: financialAccounts.id,
        institution: financialAccounts.institution,
        encryptedCredentials: financialAccounts.encryptedCredentials,
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
        { error: "No credentials found. Set up the account first." },
        { status: 400 },
      );
    }

    const creds = JSON.parse(decrypt(account.encryptedCredentials)) as Record<string, string>;
    const otpPendingStr = creds["_otpPending"];

    if (!otpPendingStr) {
      return NextResponse.json(
        { error: "No pending OTP. Call /otp/start first." },
        { status: 400 },
      );
    }

    const otpPending = JSON.parse(otpPendingStr) as {
      deviceToken: string;
      otpContext: string;
      phoneNumber: string;
    };

    // Verify OTP with ONE Zero identity API → get long-term token
    const otpLongTermToken = await verifyOtp(otpPending.otpContext, body.otpCode);

    // Validate the full auth flow works with this token
    await validateCredentials(
      creds["email"]!,
      creds["password"]!,
      otpLongTermToken,
    );

    // Store the long-term token in credentials, remove pending state
    const finalCreds = {
      email: creds["email"],
      password: creds["password"],
      otpLongTermToken,
    };

    await db
      .update(financialAccounts)
      .set({ encryptedCredentials: encrypt(JSON.stringify(finalCreds)) })
      .where(eq(financialAccounts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OTP verification failed";
    console.error("POST /api/accounts/[id]/otp/verify error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
