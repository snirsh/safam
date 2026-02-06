import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { households, users, webauthnCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRegistrationOptions } from "@/lib/auth/webauthn";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { displayName?: unknown };
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!displayName || displayName.length > 100) {
      return NextResponse.json(
        { error: "displayName is required (1-100 chars)" },
        { status: 400 },
      );
    }

    // Check household capacity (max 2 users)
    const allHouseholds = await db.select().from(households).limit(1);
    const household = allHouseholds[0];

    if (household) {
      const userCount = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.householdId, household.id));

      if (userCount.length >= 2) {
        return NextResponse.json(
          { error: "Household is full (max 2 members)" },
          { status: 400 },
        );
      }

      // Get existing credential IDs to exclude (prevent re-registration)
      const existingCreds = await db
        .select({ id: webauthnCredentials.id })
        .from(webauthnCredentials)
        .innerJoin(users, eq(webauthnCredentials.userId, users.id))
        .where(eq(users.householdId, household.id));

      const { options, challengeId } = await getRegistrationOptions(
        displayName,
        existingCreds.map((c) => c.id),
      );

      return NextResponse.json({ options, challengeId });
    }

    // No household yet — first user
    const { options, challengeId } = await getRegistrationOptions(
      displayName,
      [],
    );

    return NextResponse.json({ options, challengeId });
  } catch (error) {
    console.error("Register options error:", error);
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 },
    );
  }
}
