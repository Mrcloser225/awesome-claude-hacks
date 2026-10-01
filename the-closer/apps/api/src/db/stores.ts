import { and, desc, eq } from "drizzle-orm";
import type { KnowledgeDoc, Playbook } from "@closer/core";
import type { UserRecord, UserStore } from "../auth.js";
import type { CallRecord, CallSource, CallStore } from "../session/call-store.js";
import type { KnowledgeStore, PlaybookStore } from "../stores.js";
import type { CalendarConnection, CalendarStore, ScheduledBot } from "../autojoin/types.js";
import type { Db } from "./client.js";
import { calendarConnections, calls, knowledge, orgs, playbooks, scheduledBots, users } from "./schema.js";

export class PgUserStore implements UserStore {
  constructor(private readonly db: Db) {}
  async findByEmail(email: string) {
    const r = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return r[0] ? toUser(r[0]) : null;
  }
  async findById(id: string) {
    const r = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return r[0] ? toUser(r[0]) : null;
  }
  async create(u: UserRecord) {
    await this.db.transaction(async (tx) => {
      await tx.insert(orgs).values({ id: u.orgId, name: u.company }).onConflictDoNothing();
      await tx.insert(users).values({ id: u.id, orgId: u.orgId, email: u.email, name: u.name, company: u.company, passwordHash: u.passwordHash });
    });
  }
}
const toUser = (r: typeof users.$inferSelect): UserRecord => ({ id: r.id, orgId: r.orgId, email: r.email, name: r.name, company: r.company, passwordHash: r.passwordHash, createdAt: r.createdAt.getTime() });

export class PgCallStore implements CallStore {
  constructor(private readonly db: Db) {}
  async upsert(rec: CallRecord) {
    const row = {
      id: rec.id, orgId: rec.orgId, title: rec.title, source: rec.source, externalId: rec.externalId ?? null, context: rec.context,
      startedAt: rec.startedAt, endedAt: rec.endedAt, transcript: rec.transcript, events: rec.events, insight: rec.insight, summary: rec.summary,
    };
    await this.db.insert(calls).values(row).onConflictDoUpdate({ target: calls.id, set: row });
  }
  async get(orgId: string, id: string) {
    const r = await this.db.select().from(calls).where(and(eq(calls.id, id), eq(calls.orgId, orgId))).limit(1);
    return r[0] ? toCall(r[0]) : null;
  }
  async list(orgId: string) {
    const rows = await this.db.select().from(calls).where(eq(calls.orgId, orgId)).orderBy(desc(calls.startedAt)).limit(200);
    return rows.map(toCall);
  }
}
const toCall = (r: typeof calls.$inferSelect): CallRecord => ({
  id: r.id, orgId: r.orgId, title: r.title, source: r.source as CallSource, externalId: r.externalId ?? undefined,
  context: r.context as CallRecord["context"], startedAt: r.startedAt, endedAt: r.endedAt,
  transcript: r.transcript as CallRecord["transcript"], events: r.events as CallRecord["events"],
  insight: r.insight as CallRecord["insight"], summary: r.summary as CallRecord["summary"],
});

export class PgKnowledgeStore implements KnowledgeStore {
  constructor(private readonly db: Db) {}
  async list(orgId: string) {
    const rows = await this.db.select().from(knowledge).where(eq(knowledge.orgId, orgId));
    return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, tags: r.tags, updatedAt: r.updatedAt.getTime() }));
  }
  async save(orgId: string, doc: KnowledgeDoc) {
    const row = { id: doc.id, orgId, title: doc.title, body: doc.body, tags: doc.tags ?? [], updatedAt: new Date() };
    await this.db.insert(knowledge).values(row).onConflictDoUpdate({ target: [knowledge.orgId, knowledge.id], set: row });
    return { ...doc, updatedAt: row.updatedAt.getTime() };
  }
  async delete(orgId: string, id: string) {
    await this.db.delete(knowledge).where(and(eq(knowledge.orgId, orgId), eq(knowledge.id, id)));
  }
}

export class PgPlaybookStore implements PlaybookStore {
  constructor(private readonly db: Db, private readonly seed?: Playbook) {}
  async list(orgId: string) {
    const rows = await this.db.select().from(playbooks).where(eq(playbooks.orgId, orgId));
    const own = rows.map((r) => r.body as Playbook);
    return own.length ? own : this.seed ? [this.seed] : [];
  }
  async get(orgId: string, id: string) {
    const r = await this.db.select().from(playbooks).where(and(eq(playbooks.orgId, orgId), eq(playbooks.id, id))).limit(1);
    return r[0] ? (r[0].body as Playbook) : this.seed?.id === id ? this.seed : null;
  }
  async save(orgId: string, pb: Playbook) {
    const row = { id: pb.id, orgId, body: pb, updatedAt: new Date() };
    await this.db.insert(playbooks).values(row).onConflictDoUpdate({ target: [playbooks.orgId, playbooks.id], set: row });
    return pb;
  }
}

export class PgCalendarStore implements CalendarStore {
  constructor(private readonly db: Db) {}
  async listAll() { return (await this.db.select().from(calendarConnections)).map(toConn); }
  async listForUser(userId: string) { return (await this.db.select().from(calendarConnections).where(eq(calendarConnections.userId, userId))).map(toConn); }
  async get(id: string) { const r = await this.db.select().from(calendarConnections).where(eq(calendarConnections.id, id)).limit(1); return r[0] ? toConn(r[0]) : null; }
  async save(c: CalendarConnection) {
    const row = { id: c.id, orgId: c.orgId, userId: c.userId, provider: c.provider, accountEmail: c.accountEmail ?? null, accessToken: c.accessToken, refreshToken: c.refreshToken ?? null, expiresAt: c.expiresAt, autoJoin: c.autoJoin, externalOnly: c.externalOnly, botName: c.botName ?? null };
    await this.db.insert(calendarConnections).values(row).onConflictDoUpdate({ target: calendarConnections.id, set: row });
  }
  async delete(id: string) {
    await this.db.delete(scheduledBots).where(eq(scheduledBots.connectionId, id));
    await this.db.delete(calendarConnections).where(eq(calendarConnections.id, id));
  }
  async isScheduled(eventKey: string) { const r = await this.db.select({ k: scheduledBots.eventKey }).from(scheduledBots).where(eq(scheduledBots.eventKey, eventKey)).limit(1); return r.length > 0; }
  async markScheduled(s: ScheduledBot) { await this.db.insert(scheduledBots).values(s).onConflictDoNothing(); }
  async scheduledForConnection(connectionId: string) { return this.db.select().from(scheduledBots).where(eq(scheduledBots.connectionId, connectionId)); }
}
const toConn = (r: typeof calendarConnections.$inferSelect): CalendarConnection => ({
  id: r.id, orgId: r.orgId, userId: r.userId, provider: r.provider as CalendarConnection["provider"], accountEmail: r.accountEmail ?? undefined,
  accessToken: r.accessToken, refreshToken: r.refreshToken ?? undefined, expiresAt: r.expiresAt, autoJoin: r.autoJoin, externalOnly: r.externalOnly, botName: r.botName ?? undefined,
});
