import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { KnowledgeDoc, Playbook } from "@closer/core";
import type { UserRecord, UserStore } from "../auth.js";
import type { CallRecord, CallSource, CallStore } from "../session/call-store.js";
import type { KnowledgeStore, PlaybookStore } from "../stores.js";
import type { CalendarConnection, CalendarStore, ScheduledBot } from "../autojoin/types.js";
import type { ApiKeyRecord, AuthToken, CrmConnection, Member, OrgRecord, OrgStore, Role } from "../org-store.js";
import { NoopCipher, type Cipher } from "../platform/crypto.js";
import type { Db } from "./client.js";
import { apiKeys, authTokens, calendarConnections, calls, crmConnections, knowledge, orgs, playbooks, scheduledBots, usage, users } from "./schema.js";

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
      await tx.insert(users).values({ id: u.id, orgId: u.orgId, email: u.email, name: u.name, company: u.company, role: u.role, passwordHash: u.passwordHash, emailVerifiedAt: u.emailVerifiedAt ?? null });
    });
  }
}
const toUser = (r: typeof users.$inferSelect): UserRecord => ({ id: r.id, orgId: r.orgId, email: r.email, name: r.name, company: r.company, role: r.role as Role, passwordHash: r.passwordHash, emailVerifiedAt: r.emailVerifiedAt ?? undefined, createdAt: r.createdAt.getTime() });

export class PgCallStore implements CallStore {
  constructor(private readonly db: Db) {}
  async upsert(rec: CallRecord) {
    const row = {
      id: rec.id, orgId: rec.orgId, userId: rec.userId ?? null, crmRecordId: rec.crmRecordId ?? null, title: rec.title, source: rec.source, externalId: rec.externalId ?? null, context: rec.context,
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
  async delete(orgId: string, id: string) { await this.db.delete(calls).where(and(eq(calls.orgId, orgId), eq(calls.id, id))); }
  async purgeOlderThan(orgId: string, cutoffMs: number) {
    const r = await this.db.delete(calls).where(and(eq(calls.orgId, orgId), lt(calls.startedAt, cutoffMs))).returning({ id: calls.id });
    return r.length;
  }
}
const toCall = (r: typeof calls.$inferSelect): CallRecord => ({
  id: r.id, orgId: r.orgId, userId: r.userId ?? undefined, crmRecordId: r.crmRecordId ?? undefined, title: r.title, source: r.source as CallSource, externalId: r.externalId ?? undefined,
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
  constructor(private readonly db: Db, private readonly cipher: Cipher = new NoopCipher()) {}
  private toConn = (r: typeof calendarConnections.$inferSelect): CalendarConnection => ({ ...toConn(r), accessToken: this.cipher.decrypt(r.accessToken), refreshToken: r.refreshToken ? this.cipher.decrypt(r.refreshToken) : undefined });
  async listAll() { return (await this.db.select().from(calendarConnections)).map(this.toConn); }
  async listForUser(userId: string) { return (await this.db.select().from(calendarConnections).where(eq(calendarConnections.userId, userId))).map(this.toConn); }
  async get(id: string) { const r = await this.db.select().from(calendarConnections).where(eq(calendarConnections.id, id)).limit(1); return r[0] ? this.toConn(r[0]) : null; }
  async save(c: CalendarConnection) {
    const row = { id: c.id, orgId: c.orgId, userId: c.userId, provider: c.provider, accountEmail: c.accountEmail ?? null, accessToken: this.cipher.encrypt(c.accessToken), refreshToken: c.refreshToken ? this.cipher.encrypt(c.refreshToken) : null, expiresAt: c.expiresAt, autoJoin: c.autoJoin, externalOnly: c.externalOnly, botName: c.botName ?? null };
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

export class PgOrgStore implements OrgStore {
  constructor(private readonly db: Db, private readonly cipher: Cipher = new NoopCipher()) {}
  async getOrg(id: string) { const r = await this.db.select().from(orgs).where(eq(orgs.id, id)).limit(1); return r[0] ? toOrg(r[0]) : null; }
  async updateOrg(id: string, patch: Partial<OrgRecord>) {
    const set: Partial<typeof orgs.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.plan !== undefined) set.plan = patch.plan;
    if (patch.seats !== undefined) set.seats = patch.seats;
    if (patch.stripeCustomerId !== undefined) set.stripeCustomerId = patch.stripeCustomerId;
    if (patch.stripeSubscriptionId !== undefined) set.stripeSubscriptionId = patch.stripeSubscriptionId;
    if (patch.retentionDays !== undefined) set.retentionDays = patch.retentionDays;
    if (patch.disclosure !== undefined) set.disclosure = patch.disclosure;
    if (patch.trialCallsUsed !== undefined) set.trialCallsUsed = patch.trialCallsUsed;
    const r = await this.db.update(orgs).set(set).where(eq(orgs.id, id)).returning();
    if (!r[0]) throw new Error("no such org");
    return toOrg(r[0]);
  }
  async findOrgByStripeCustomer(c: string) { const r = await this.db.select().from(orgs).where(eq(orgs.stripeCustomerId, c)).limit(1); return r[0] ? toOrg(r[0]) : null; }
  async listMembers(orgId: string): Promise<Member[]> {
    const rows = await this.db.select().from(users).where(eq(users.orgId, orgId));
    return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role as Role, emailVerifiedAt: r.emailVerifiedAt ?? undefined, createdAt: r.createdAt.getTime() }));
  }
  async setRole(orgId: string, userId: string, role: Role) { await this.db.update(users).set({ role }).where(and(eq(users.orgId, orgId), eq(users.id, userId))); }
  async removeMember(orgId: string, userId: string) { await this.db.delete(users).where(and(eq(users.orgId, orgId), eq(users.id, userId))); }
  async markVerified(userId: string, at: number) { await this.db.update(users).set({ emailVerifiedAt: at }).where(eq(users.id, userId)); }
  async setPassword(userId: string, passwordHash: string) { await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId)); }
  async createToken(t: AuthToken) { await this.db.insert(authTokens).values({ id: t.id, orgId: t.orgId, userId: t.userId ?? null, email: t.email, kind: t.kind, role: t.role ?? null, tokenHash: t.tokenHash, expiresAt: t.expiresAt, usedAt: t.usedAt ?? null }); }
  async findToken(h: string) {
    const r = await this.db.select().from(authTokens).where(eq(authTokens.tokenHash, h)).limit(1);
    const t = r[0]; if (!t) return null;
    return { id: t.id, orgId: t.orgId, userId: t.userId ?? undefined, email: t.email, kind: t.kind as AuthToken["kind"], role: (t.role ?? undefined) as Role | undefined, tokenHash: t.tokenHash, expiresAt: t.expiresAt, usedAt: t.usedAt ?? undefined };
  }
  async consumeToken(id: string, at: number) { await this.db.update(authTokens).set({ usedAt: at }).where(eq(authTokens.id, id)); }
  async createApiKey(k: ApiKeyRecord) { await this.db.insert(apiKeys).values({ id: k.id, orgId: k.orgId, userId: k.userId ?? null, keyHash: k.keyHash, label: k.label ?? null }); }
  async listApiKeys(orgId: string) { return (await this.db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId))).map(toKey); }
  async findApiKey(h: string) { const r = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, h)).limit(1); return r[0] ? toKey(r[0]) : null; }
  async revokeApiKey(orgId: string, id: string, at: number) { await this.db.update(apiKeys).set({ revokedAt: new Date(at) }).where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, id))); }
  async saveCrm(c: CrmConnection) {
    const row = { id: c.id, orgId: c.orgId, provider: c.provider, instanceUrl: c.instanceUrl ?? null, accessToken: this.cipher.encrypt(c.accessToken), refreshToken: c.refreshToken ? this.cipher.encrypt(c.refreshToken) : null, expiresAt: c.expiresAt, autoPush: c.autoPush };
    await this.db.insert(crmConnections).values(row).onConflictDoUpdate({ target: [crmConnections.orgId, crmConnections.provider], set: row });
  }
  async listCrm(orgId: string): Promise<CrmConnection[]> {
    return (await this.db.select().from(crmConnections).where(eq(crmConnections.orgId, orgId))).map((r) => ({ id: r.id, orgId: r.orgId, provider: r.provider as CrmConnection["provider"], instanceUrl: r.instanceUrl ?? undefined, accessToken: this.cipher.decrypt(r.accessToken), refreshToken: r.refreshToken ? this.cipher.decrypt(r.refreshToken) : undefined, expiresAt: r.expiresAt, autoPush: r.autoPush }));
  }
  async deleteCrm(orgId: string, id: string) { await this.db.delete(crmConnections).where(and(eq(crmConnections.orgId, orgId), eq(crmConnections.id, id))); }
  async incrementUsage(orgId: string, day: string, metric: string, by = 1) {
    const r = await this.db.insert(usage).values({ orgId, day, metric, count: by }).onConflictDoUpdate({ target: [usage.orgId, usage.day, usage.metric], set: { count: sql`${usage.count} + ${by}` } }).returning({ count: usage.count });
    return r[0]?.count ?? by;
  }
  async getUsage(orgId: string, day: string) {
    const rows = await this.db.select().from(usage).where(and(eq(usage.orgId, orgId), eq(usage.day, day)));
    return Object.fromEntries(rows.map((r) => [r.metric, r.count]));
  }
  async deleteOrg(orgId: string) {
    await this.db.transaction(async (tx) => {
      await tx.delete(scheduledBots).where(sql`${scheduledBots.connectionId} in (select id from ${calendarConnections} where ${calendarConnections.orgId} = ${orgId})`);
      await tx.delete(calendarConnections).where(eq(calendarConnections.orgId, orgId));
      await tx.delete(crmConnections).where(eq(crmConnections.orgId, orgId));
      await tx.delete(usage).where(eq(usage.orgId, orgId));
      await tx.delete(authTokens).where(eq(authTokens.orgId, orgId));
      await tx.delete(apiKeys).where(eq(apiKeys.orgId, orgId));
      await tx.delete(calls).where(eq(calls.orgId, orgId));
      await tx.delete(knowledge).where(eq(knowledge.orgId, orgId));
      await tx.delete(playbooks).where(eq(playbooks.orgId, orgId));
      await tx.delete(users).where(eq(users.orgId, orgId));
      await tx.delete(orgs).where(eq(orgs.id, orgId));
    });
  }
}
const toOrg = (r: typeof orgs.$inferSelect): OrgRecord => ({ id: r.id, name: r.name, plan: r.plan as OrgRecord["plan"], seats: r.seats, stripeCustomerId: r.stripeCustomerId ?? undefined, stripeSubscriptionId: r.stripeSubscriptionId ?? undefined, retentionDays: r.retentionDays, disclosure: r.disclosure as OrgRecord["disclosure"], trialCallsUsed: r.trialCallsUsed, createdAt: r.createdAt.getTime() });
const toKey = (r: typeof apiKeys.$inferSelect): ApiKeyRecord => ({ id: r.id, orgId: r.orgId, userId: r.userId ?? undefined, keyHash: r.keyHash, label: r.label ?? undefined, revokedAt: r.revokedAt?.getTime(), createdAt: r.createdAt.getTime() });
