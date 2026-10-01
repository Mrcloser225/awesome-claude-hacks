export type Role = "rep" | "manager" | "admin";
export type Plan = "trial" | "solo" | "team" | "enterprise";
export type Disclosure = "chat_message" | "name_only" | "off";

export interface OrgRecord {
  id: string;
  name: string;
  plan: Plan;
  seats: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  retentionDays: number;
  disclosure: Disclosure;
  trialCallsUsed: number;
  createdAt: number;
}

export interface Member { id: string; email: string; name: string; role: Role; emailVerifiedAt?: number; createdAt: number }

export interface AuthToken {
  id: string;
  orgId: string;
  userId?: string;
  email: string;
  kind: "verify" | "reset" | "invite";
  role?: Role;
  tokenHash: string;
  expiresAt: number;
  usedAt?: number;
}

export interface ApiKeyRecord { id: string; orgId: string; userId?: string; keyHash: string; label?: string; revokedAt?: number; createdAt: number }

export interface CrmConnection {
  id: string;
  orgId: string;
  provider: "salesforce" | "hubspot";
  instanceUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  autoPush: boolean;
}

/** Everything about an organisation that is not a call or coaching material. */
export interface OrgStore {
  getOrg(id: string): Promise<OrgRecord | null>;
  updateOrg(id: string, patch: Partial<Omit<OrgRecord, "id" | "createdAt">>): Promise<OrgRecord>;
  findOrgByStripeCustomer(customerId: string): Promise<OrgRecord | null>;
  listMembers(orgId: string): Promise<Member[]>;
  setRole(orgId: string, userId: string, role: Role): Promise<void>;
  removeMember(orgId: string, userId: string): Promise<void>;
  markVerified(userId: string, at: number): Promise<void>;
  setPassword(userId: string, passwordHash: string): Promise<void>;
  createToken(t: AuthToken): Promise<void>;
  findToken(tokenHash: string): Promise<AuthToken | null>;
  consumeToken(id: string, at: number): Promise<void>;
  createApiKey(k: ApiKeyRecord): Promise<void>;
  listApiKeys(orgId: string): Promise<ApiKeyRecord[]>;
  findApiKey(keyHash: string): Promise<ApiKeyRecord | null>;
  revokeApiKey(orgId: string, id: string, at: number): Promise<void>;
  saveCrm(c: CrmConnection): Promise<void>;
  listCrm(orgId: string): Promise<CrmConnection[]>;
  deleteCrm(orgId: string, id: string): Promise<void>;
  incrementUsage(orgId: string, day: string, metric: string, by?: number): Promise<number>;
  getUsage(orgId: string, day: string): Promise<Record<string, number>>;
  /** Deletes the org and everything that references it. Irreversible. */
  deleteOrg(orgId: string): Promise<void>;
}

export const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

interface UserRow { id: string; orgId: string; email: string; name: string; role: Role; passwordHash: string; emailVerifiedAt?: number; createdAt: number }

export class MemoryOrgStore implements OrgStore {
  readonly orgs = new Map<string, OrgRecord>();
  /** Shared with the MemoryUserStore so roles and verification stay consistent. */
  readonly members: Map<string, UserRow>;
  readonly tokens = new Map<string, AuthToken>();
  readonly keys = new Map<string, ApiKeyRecord>();
  readonly crm = new Map<string, CrmConnection>();
  readonly usage = new Map<string, number>();

  constructor(members: Map<string, UserRow> = new Map()) { this.members = members; }

  ensureOrg(id: string, name: string): OrgRecord {
    let o = this.orgs.get(id);
    if (!o) { o = { id, name, plan: "trial", seats: 1, retentionDays: 0, disclosure: "chat_message", trialCallsUsed: 0, createdAt: Date.now() }; this.orgs.set(id, o); }
    return o;
  }
  async getOrg(id: string) { return this.orgs.get(id) ?? null; }
  async updateOrg(id: string, patch: Partial<OrgRecord>) { const o = { ...this.ensureOrg(id, "Org"), ...patch }; this.orgs.set(id, o); return o; }
  async findOrgByStripeCustomer(c: string) { return [...this.orgs.values()].find((o) => o.stripeCustomerId === c) ?? null; }
  async listMembers(orgId: string): Promise<Member[]> { return [...this.members.values()].filter((m) => m.orgId === orgId).map((m) => ({ id: m.id, email: m.email, name: m.name, role: m.role, emailVerifiedAt: m.emailVerifiedAt, createdAt: m.createdAt })); }
  async setRole(orgId: string, userId: string, role: Role) { const m = this.members.get(userId); if (m && m.orgId === orgId) m.role = role; }
  async removeMember(orgId: string, userId: string) { const m = this.members.get(userId); if (m && m.orgId === orgId) this.members.delete(userId); }
  async markVerified(userId: string, at: number) { const m = this.members.get(userId); if (m) m.emailVerifiedAt = at; }
  async setPassword(userId: string, passwordHash: string) { const m = this.members.get(userId); if (m) m.passwordHash = passwordHash; }
  async createToken(t: AuthToken) { this.tokens.set(t.tokenHash, t); }
  async findToken(h: string) { return this.tokens.get(h) ?? null; }
  async consumeToken(id: string, at: number) { for (const t of this.tokens.values()) if (t.id === id) t.usedAt = at; }
  async createApiKey(k: ApiKeyRecord) { this.keys.set(k.id, k); }
  async listApiKeys(orgId: string) { return [...this.keys.values()].filter((k) => k.orgId === orgId); }
  async findApiKey(h: string) { return [...this.keys.values()].find((k) => k.keyHash === h) ?? null; }
  async revokeApiKey(orgId: string, id: string, at: number) { const k = this.keys.get(id); if (k && k.orgId === orgId) k.revokedAt = at; }
  async saveCrm(c: CrmConnection) { this.crm.set(`${c.orgId}/${c.provider}`, c); }
  async listCrm(orgId: string) { return [...this.crm.values()].filter((c) => c.orgId === orgId); }
  async deleteCrm(orgId: string, id: string) { for (const [k, c] of this.crm) if (c.orgId === orgId && c.id === id) this.crm.delete(k); }
  async incrementUsage(orgId: string, day: string, metric: string, by = 1) { const k = `${orgId}/${day}/${metric}`; const n = (this.usage.get(k) ?? 0) + by; this.usage.set(k, n); return n; }
  async getUsage(orgId: string, day: string) { const out: Record<string, number> = {}; for (const [k, v] of this.usage) if (k.startsWith(`${orgId}/${day}/`)) out[k.split("/")[2]!] = v; return out; }
  async deleteOrg(orgId: string) {
    this.orgs.delete(orgId);
    for (const [id, m] of this.members) if (m.orgId === orgId) this.members.delete(id);
    for (const [h, t] of this.tokens) if (t.orgId === orgId) this.tokens.delete(h);
    for (const [id, k] of this.keys) if (k.orgId === orgId) this.keys.delete(id);
    for (const [k, c] of this.crm) if (c.orgId === orgId) this.crm.delete(k);
  }
}
