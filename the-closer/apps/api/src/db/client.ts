import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(url: string) {
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

/** Applies the SQL migrations in apps/api/drizzle. Safe to run on every boot. */
export async function runMigrations(url: string): Promise<void> {
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(here, "../../drizzle");
  await migrate(db, { migrationsFolder });
  await sql.end();
}
