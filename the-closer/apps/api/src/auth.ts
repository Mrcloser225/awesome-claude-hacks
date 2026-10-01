import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";

export interface Principal {
  orgId: string;
  userId: string;
  name: string;
  company: string;
  email?: string;
  role: "rep" | "manager" | "admin";
  /** Set when the request authenticated with an API key rather than a session. */
  apiKeyId?: string;
}

export interface AuthResolver {
  resolve(token: string): Promise<Principal | null>;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Single-tenant resolver for local development and the desktop app; production uses the api_keys table. */
export class DevAuth implements AuthResolver {
  constructor(private readonly devKey: string | undefined) {}
  async resolve(token: string): Promise<Principal | null> {
    if (!this.devKey || token !== this.devKey) return null;
    return { orgId: "dev-org", userId: "dev-user", name: "Rep", company: "Your company", role: "admin" };
  }
}

export interface UserRecord {
  id: string;
  orgId: string;
  email: string;
  name: string;
  company: string;
  role: "rep" | "manager" | "admin";
  passwordHash: string; // salt:hex
  emailVerifiedAt?: number;
  createdAt: number;
}

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(u: UserRecord): Promise<void>;
}

export class MemoryUserStore implements UserStore {
  readonly byId = new Map<string, UserRecord>();
  async findByEmail(email: string) { return [...this.byId.values()].find((u) => u.email === email.toLowerCase()) ?? null; }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async create(u: UserRecord) { this.byId.set(u.id, u); }
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const a = scryptSync(pw, salt, 64);
  const b = Buffer.from(hex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signed session tokens for the web app. Also accepted as a Bearer token by the desktop app and API clients. */
export class JwtAuth implements AuthResolver {
  private readonly key: Uint8Array;
  constructor(secret: string, private readonly users: UserStore, private readonly ttl = "30d") {
    this.key = new TextEncoder().encode(secret);
  }
  async issue(user: UserRecord): Promise<string> {
    return new SignJWT({ org: user.orgId }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime(this.ttl).sign(this.key);
  }
  async resolve(token: string): Promise<Principal | null> {
    try {
      const { payload } = await jwtVerify(token, this.key);
      const user = payload.sub ? await this.users.findById(payload.sub) : null;
      if (!user) return null;
      return { orgId: user.orgId, userId: user.id, name: user.name, company: user.company, email: user.email, role: user.role };
    } catch {
      return null;
    }
  }
}

/** API keys minted in the app: "ck_" + 40 random chars, stored hashed. */
export class ApiKeyAuth implements AuthResolver {
  constructor(private readonly find: (hash: string) => Promise<{ orgId: string; userId?: string; revokedAt?: number } | null>, private readonly users: UserStore) {}
  async resolve(token: string): Promise<Principal | null> {
    if (!token.startsWith("ck_")) return null;
    const rec = await this.find(hashKey(token));
    if (!rec || rec.revokedAt) return null;
    const user = rec.userId ? await this.users.findById(rec.userId) : null;
    return { orgId: rec.orgId, userId: user?.id ?? "api", name: user?.name ?? "API", company: user?.company ?? "", email: user?.email, role: user?.role ?? "admin", apiKeyId: token.slice(0, 10) };
  }
}

/** Tries each resolver in order: dev key, API key, then JWT. */
export class CompositeAuth implements AuthResolver {
  constructor(private readonly resolvers: AuthResolver[]) {}
  async resolve(token: string): Promise<Principal | null> {
    for (const r of this.resolvers) {
      const p = await r.resolve(token);
      if (p) return p;
    }
    return null;
  }
}

export const SESSION_COOKIE = "closer_session";

export function extractToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  const q = (req.query as Record<string, string | undefined>)?.token;
  if (q) return q;
  const cookie = req.headers.cookie;
  if (cookie) {
    const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(cookie);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return undefined;
}
