import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "safam-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export interface SessionPayload {
  userId: string;
  householdId: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("Missing JWT_SECRET env var");
  return new TextEncoder().encode(secret);
}

// ─── Create / Destroy ───────────────────────────────────

export async function createSession(
  userId: string,
  householdId: string,
): Promise<void> {
  const token = await new SignJWT({ userId, householdId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ─── Read ───────────────────────────────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  // Demo mode bypass: auto-login as the first seeded user (works in production)
  if (process.env["NEXT_PUBLIC_DEMO_MODE"] === "true") {
    return getDevSession();
  }

  // Dev mode bypass: auto-login as the first seeded user
  if (process.env["NODE_ENV"] === "development") {
    return getDevSession();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const userId = payload["userId"];
    const householdId = payload["householdId"];
    if (typeof userId !== "string" || typeof householdId !== "string") {
      return null;
    }
    return { userId, householdId };
  } catch {
    return null;
  }
}

async function getDevSession(): Promise<SessionPayload | null> {
  // Lazily query the first user from DB
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");

  const rows = await db.select().from(users).limit(1);
  const user = rows[0];
  if (!user) return null;

  return {
    userId: user.id,
    householdId: user.householdId,
  };
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
