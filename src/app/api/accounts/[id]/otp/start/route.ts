import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto/encryption";
import { triggerOtp } from "@/lib/scraper/one-zero";

/**
 * POST /api/accounts/[id]/otp/start
 * Triggers OTP SMS for ONE Zero account setup.
 * Body: { phoneNumber: string }
 * Returns: { success: true } on SMS sent, stores pending OTP context.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = (await request.json()) as { phoneNumber?: string };

    if (!body.phoneNumber) {
      return NextResponse.json(
        { error: "phoneNumber is required" },
        { status: 400 },
      );
    }

    // Verify account belongs to household and is ONE Zero
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

    if (account.institution !== "one_zero") {
      return NextResponse.json(
        { error: "OTP setup is only supported for ONE Zero" },
        { status: 400 },
      );
    }

    // Trigger OTP — calls ONE Zero identity API
    const { deviceToken, otpContext } = await triggerOtp(body.phoneNumber);

    // Store the OTP context temporarily in the account's encrypted credentials
    // alongside existing email + password
    const existingCreds = account.encryptedCredentials
      ? (JSON.parse(decrypt(account.encryptedCredentials)) as Record<string, string>)
      : {};

    const updatedCreds = {
      ...existingCreds,
      _otpPending: JSON.stringify({ deviceToken, otpContext, phoneNumber: body.phoneNumber }),
    };

    await db
      .update(financialAccounts)
      .set({ encryptedCredentials: encrypt(JSON.stringify(updatedCreds)) })
      .where(eq(financialAccounts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger OTP";
    console.error("POST /api/accounts/[id]/otp/start error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
