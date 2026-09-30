import type { Config } from "drizzle-kit";
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://closer:closer@localhost:5432/closer" },
} satisfies Config;
