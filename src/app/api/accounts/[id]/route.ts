import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/lib/crypto/encryption";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      credentials?: Record<string, string>;
      isActive?: boolean;
    };

    // Verify account belongs to household
    const [existing] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, id),
          eq(financialAccounts.householdId, session.householdId),
        ),
      );

    if (!existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates["name"] = body.name;
    if (body.isActive !== undefined) updates["isActive"] = body.isActive;
    if (body.credentials !== undefined) {
      updates["encryptedCredentials"] = encrypt(
        JSON.stringify(body.credentials),
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(financialAccounts)
      .set(updates)
      .where(eq(financialAccounts.id, id))
      .returning({
        id: financialAccounts.id,
        name: financialAccounts.name,
        institution: financialAccounts.institution,
        accountType: financialAccounts.accountType,
        lastFourDigits: financialAccounts.lastFourDigits,
        isActive: financialAccounts.isActive,
        lastSyncedAt: financialAccounts.lastSyncedAt,
      });

    return NextResponse.json({ account: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update account";
    console.error("PATCH /api/accounts/[id] error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
