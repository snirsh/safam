import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Canonical DB type — both Neon and postgres.js instances are cast to this.
// The Drizzle API surface (select, insert, update, delete, etc.) is identical.
type DrizzleDb = NeonHttpDatabase<typeof schema>;

function getDbUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

function isNeonUrl(url: string): boolean {
  return url.includes("neon.tech");
}

function createDrizzleInstance(): DrizzleDb {
  const url = getDbUrl();

  if (isNeonUrl(url)) {
    const sql = neon(url);
    return drizzleNeon({ client: sql, schema });
  }

  // Local Postgres (Docker, etc.)
  const sql = postgres(url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return drizzlePg({ client: sql as any, schema }) as unknown as DrizzleDb;
}

let _db: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  if (!_db) {
    _db = createDrizzleInstance();
  }
  return _db;
}

// Lazy proxy — db is only created on first property access (not at import time)
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Database = DrizzleDb;
