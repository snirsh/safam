import { cookies } from "next/headers";

const SESSION_COOKIE = "safam-session";

export interface SessionPayload {
  userId: string;
  householdId: string;
}

export async function getSession(): Promise<SessionPayload | null> {
  // Dev mode bypass: auto-login as the first seeded user
  if (process.env["NODE_ENV"] === "development") {
    return getDevSession();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // TODO: Phase 2 — verify JWT with jose
  return null;
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
