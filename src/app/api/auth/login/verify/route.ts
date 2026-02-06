import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthentication } from "@/lib/auth/webauthn";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      response?: AuthenticationResponseJSON;
      challengeId?: string;
    };

    if (!body.response || !body.challengeId) {
      return NextResponse.json(
        { error: "Missing response or challengeId" },
        { status: 400 },
      );
    }

    const { userId } = await verifyAuthentication(
      body.response,
      body.challengeId,
    );

    // Look up user for session
    const [user] = await db
      .select({ id: users.id, householdId: users.householdId })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    await createSession(user.id, user.householdId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    console.error("Login verify error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
