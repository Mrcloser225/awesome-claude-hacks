import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { GLAXTONS_PLAYBOOK } from "@closer/core";
import * as schema from "../src/db/schema.js";
import { PgCalendarStore, PgCallStore, PgKnowledgeStore, PgPlaybookStore, PgUserStore } from "../src/db/stores.js";
import { hashPassword } from "../src/auth.js";

/**
 * Runs only when TEST_DATABASE_URL points at a Postgres (CI starts one; locally
 * `docker compose up -d postgres`). Proves the Drizzle stores round-trip every
 * record type through the real schema and migrations.
 */
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("Postgres stores", () => {
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  beforeAll(async () => {
    sql = postgres(url!, { max: 2 });
    db = drizzle(sql, { schema });
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  });
  afterAll(async () => { await sql.end(); });

  it("users: create, find by email case-insensitively, org row created", async () => {
    const users = new PgUserStore(db);
    const u = { id: randomUUID(), orgId: randomUUID(), email: `jp-${Date.now()}@glaxtons.co.uk`, name: "JP", company: "Glaxtons", passwordHash: hashPassword("pw12345678"), createdAt: Date.now() };
    await users.create(u);
    expect((await users.findByEmail(u.email.toUpperCase()))?.id).toBe(u.id);
    expect((await users.findById(u.id))?.company).toBe("Glaxtons");
    expect(await users.findById(randomUUID())).toBeNull();
  });

  it("calls, knowledge, playbooks and calendars are org-scoped and upsert cleanly", async () => {
    const users = new PgUserStore(db);
    const org = randomUUID(); const other = randomUUID();
    const uid = randomUUID();
    await users.create({ id: uid, orgId: org, email: `a-${Date.now()}@x.com`, name: "A", company: "X", passwordHash: "s:h", createdAt: Date.now() });
    await users.create({ id: randomUUID(), orgId: other, email: `b-${Date.now()}@y.com`, name: "B", company: "Y", passwordHash: "s:h", createdAt: Date.now() });

    const calls = new PgCallStore(db);
    const rec = { id: `call_${Date.now()}`, orgId: org, title: "Call with Acme", source: "bot" as const, context: { callId: "c", rep: { name: "A", company: "X" } }, startedAt: Date.now(), endedAt: null, transcript: [{ id: "t1", speaker: "prospect" as const, text: "hi", startMs: 0, endMs: 1, isFinal: true }], events: [], insight: null, summary: null };
    await calls.upsert(rec);
    await calls.upsert({ ...rec, endedAt: Date.now(), summary: { outcome: "advanced" } as never });
    const got = await calls.get(org, rec.id);
    expect(got?.transcript[0]?.text).toBe("hi");
    expect(got?.endedAt).toBeTypeOf("number");
    expect(await calls.get(other, rec.id)).toBeNull();
    expect((await calls.list(org)).map((c) => c.id)).toContain(rec.id);

    const kn = new PgKnowledgeStore(db);
    await kn.save(org, { id: "pricing", title: "Price list", body: "Bid review from £1,500.", tags: ["pricing"] });
    await kn.save(org, { id: "pricing", title: "Price list v2", body: "Bid review from £1,750.", tags: ["pricing"] });
    await kn.save(other, { id: "pricing", title: "Other org", body: "x" });
    expect((await kn.list(org)).map((k) => k.title)).toEqual(["Price list v2"]);
    await kn.delete(org, "pricing");
    expect(await kn.list(org)).toEqual([]);
    expect((await kn.list(other)).length).toBe(1);

    const pb = new PgPlaybookStore(db, GLAXTONS_PLAYBOOK);
    expect((await pb.list(org))[0]?.id).toBe(GLAXTONS_PLAYBOOK.id); // seed until the org saves its own
    await pb.save(org, { ...GLAXTONS_PLAYBOOK, id: "mine", name: "Mine" });
    expect((await pb.list(org)).map((p) => p.id)).toEqual(["mine"]);
    expect((await pb.get(org, "mine"))?.name).toBe("Mine");

    const cal = new PgCalendarStore(db);
    const conn = { id: randomUUID(), orgId: org, userId: uid, provider: "microsoft" as const, accountEmail: "a@x.com", accessToken: "t", refreshToken: "r", expiresAt: Date.now() + 1000, autoJoin: true, externalOnly: true, botName: undefined };
    await cal.save(conn);
    await cal.save({ ...conn, autoJoin: false, botName: "Emma" });
    expect((await cal.listForUser(uid))[0]).toMatchObject({ autoJoin: false, botName: "Emma" });
    await cal.markScheduled({ eventKey: `${conn.id}:e1`, connectionId: conn.id, callId: "c1", botId: "b1", joinAt: Date.now() });
    await cal.markScheduled({ eventKey: `${conn.id}:e1`, connectionId: conn.id, callId: "c1", botId: "b1", joinAt: Date.now() });
    expect(await cal.isScheduled(`${conn.id}:e1`)).toBe(true);
    expect((await cal.scheduledForConnection(conn.id)).length).toBe(1);
    await cal.delete(conn.id);
    expect(await cal.get(conn.id)).toBeNull();
  });
});
