import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, desc } from "drizzle-orm";
import { encrypt } from "@/lib/crypto/encryption";
import { INSTITUTIONS, type InstitutionKey } from "@/lib/constants/institutions";

export async function GET() {
  try {
    const session = await requireAuth();

    const accounts = await db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        institution: financialAccounts.institution,
        accountType: financialAccounts.accountType,
        lastFourDigits: financialAccounts.lastFourDigits,
        isActive: financialAccounts.isActive,
        lastSyncedAt: financialAccounts.lastSyncedAt,
        createdAt: financialAccounts.createdAt,
      })
      .from(financialAccounts)
      .where(eq(financialAccounts.householdId, session.householdId))
      .orderBy(desc(financialAccounts.createdAt));

    return NextResponse.json({ accounts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch accounts";
    console.error("GET /api/accounts error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = (await request.json()) as {
      name: string;
      institution: string;
      accountType: "bank" | "credit_card";
      lastFourDigits?: string;
      credentials?: Record<string, string>;
    };

    if (!body.name || !body.institution || !body.accountType) {
      return NextResponse.json(
        { error: "name, institution, and accountType are required" },
        { status: 400 },
      );
    }

    if (!(body.institution in INSTITUTIONS)) {
      return NextResponse.json(
        { error: "Unsupported institution" },
        { status: 400 },
      );
    }

    if (body.accountType !== "bank" && body.accountType !== "credit_card") {
      return NextResponse.json(
        { error: "accountType must be 'bank' or 'credit_card'" },
        { status: 400 },
      );
    }

    // Validate credential fields match the institution schema
    if (body.credentials) {
      const expected: readonly string[] =
        INSTITUTIONS[body.institution as InstitutionKey].credentials;
      const provided = Object.keys(body.credentials);
      const unexpected = provided.filter((k) => !expected.includes(k));
      if (unexpected.length > 0) {
        return NextResponse.json(
          { error: `Unexpected credential fields: ${unexpected.join(", ")}` },
          { status: 400 },
        );
      }
    }

    let encryptedCreds: string | null = null;
    if (body.credentials && Object.keys(body.credentials).length > 0) {
      encryptedCreds = encrypt(JSON.stringify(body.credentials));
    }

    const [account] = await db
      .insert(financialAccounts)
      .values({
        householdId: session.householdId,
        name: body.name,
        institution: body.institution,
        accountType: body.accountType,
        lastFourDigits: body.lastFourDigits ?? null,
        encryptedCredentials: encryptedCreds,
      })
      .returning({
        id: financialAccounts.id,
        name: financialAccounts.name,
        institution: financialAccounts.institution,
        accountType: financialAccounts.accountType,
        lastFourDigits: financialAccounts.lastFourDigits,
        isActive: financialAccounts.isActive,
        createdAt: financialAccounts.createdAt,
      });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create account";
    console.error("POST /api/accounts error:", error);

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
