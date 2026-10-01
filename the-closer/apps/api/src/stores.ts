import type { KnowledgeDoc, Playbook } from "@closer/core";

/** Org-scoped stores for the coach's material. Memory versions for dev and tests, Postgres in production. */
export interface KnowledgeStore {
  list(orgId: string): Promise<KnowledgeDoc[]>;
  save(orgId: string, doc: KnowledgeDoc): Promise<KnowledgeDoc>;
  delete(orgId: string, id: string): Promise<void>;
}
export interface PlaybookStore {
  list(orgId: string): Promise<Playbook[]>;
  get(orgId: string, id: string): Promise<Playbook | null>;
  save(orgId: string, pb: Playbook): Promise<Playbook>;
}

export class MemoryKnowledgeStore implements KnowledgeStore {
  private readonly rows = new Map<string, KnowledgeDoc>();
  private k(orgId: string, id: string) { return `${orgId}/${id}`; }
  async list(orgId: string) { return [...this.rows.entries()].filter(([k]) => k.startsWith(`${orgId}/`)).map(([, v]) => v); }
  async save(orgId: string, doc: KnowledgeDoc) { this.rows.set(this.k(orgId, doc.id), doc); return doc; }
  async delete(orgId: string, id: string) { this.rows.delete(this.k(orgId, id)); }
}

export class MemoryPlaybookStore implements PlaybookStore {
  private readonly rows = new Map<string, Playbook>();
  constructor(private readonly seed?: Playbook) {}
  private k(orgId: string, id: string) { return `${orgId}/${id}`; }
  async list(orgId: string) { const own = [...this.rows.entries()].filter(([k]) => k.startsWith(`${orgId}/`)).map(([, v]) => v); return own.length ? own : this.seed ? [this.seed] : []; }
  async get(orgId: string, id: string) { return this.rows.get(this.k(orgId, id)) ?? (this.seed?.id === id ? this.seed : null); }
  async save(orgId: string, pb: Playbook) { this.rows.set(this.k(orgId, pb.id), pb); return pb; }
}
