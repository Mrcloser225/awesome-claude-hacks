import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";

export interface Principal {
  orgId: string;
  userId: string;
  name: string;
  company: string;
}

export interface AuthResolver {
  resolve(token: string): Promise<Principal | null>;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Single-tenant resolver for local development; production uses the api_keys table. */
export class DevAuth implements AuthResolver {
  constructor(private readonly devKey: string | undefined) {}
  async resolve(token: string): Promise<Principal | null> {
    if (!this.devKey || token !== this.devKey) return null;
    return { orgId: "dev-org", userId: "dev-user", name: "Rep", company: "Your company" };
  }
}

export function extractToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  const q = (req.query as Record<string, string | undefined>)?.token;
  return q;
}
