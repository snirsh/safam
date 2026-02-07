import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts, transactions, syncLogs, recurringPatterns } from "@/lib/db/schema";
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

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

    // Delete related records first (no cascade FKs)
    await db.delete(syncLogs).where(eq(syncLogs.accountId, id));
    await db.delete(transactions).where(eq(transactions.accountId, id));
    // recurring_patterns has nullable accountId — nullify rather than delete
    await db
      .update(recurringPatterns)
      .set({ accountId: null })
      .where(eq(recurringPatterns.accountId, id));
    await db.delete(financialAccounts).where(eq(financialAccounts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete account";
    console.error("DELETE /api/accounts/[id] error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
