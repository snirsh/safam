import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { households, users, webauthnCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistration } from "@/lib/auth/webauthn";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      response?: RegistrationResponseJSON;
      challengeId?: string;
      displayName?: string;
    };

    if (!body.response || !body.challengeId || !body.displayName) {
      return NextResponse.json(
        { error: "Missing response, challengeId, or displayName" },
        { status: 400 },
      );
    }

    // Verify the registration
    const { credentialId, publicKey, counter, transports } =
      await verifyRegistration(body.response, body.challengeId);

    // Determine household: create or join
    const allHouseholds = await db.select().from(households).limit(1);
    let householdId: string;

    if (allHouseholds[0]) {
      // Join existing household (capacity already checked in options route)
      householdId = allHouseholds[0].id;

      // Double-check capacity
      const userCount = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.householdId, householdId));

      if (userCount.length >= 2) {
        return NextResponse.json(
          { error: "Household is full" },
          { status: 400 },
        );
      }
    } else {
      // Create new household
      const [newHousehold] = await db
        .insert(households)
        .values({ name: "My Family" })
        .returning({ id: households.id });

      if (!newHousehold) throw new Error("Failed to create household");
      householdId = newHousehold.id;
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        householdId,
        displayName: body.displayName,
      })
      .returning({ id: users.id });

    if (!newUser) throw new Error("Failed to create user");

    // Store WebAuthn credential
    await db.insert(webauthnCredentials).values({
      id: credentialId,
      userId: newUser.id,
      publicKey: Buffer.from(publicKey).toString("base64"),
      counter,
      transports: transports ?? null,
    });

    // Issue session
    await createSession(newUser.id, householdId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    console.error("Register verify error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
