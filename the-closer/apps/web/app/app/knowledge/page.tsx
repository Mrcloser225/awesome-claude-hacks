"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type KnowledgeDoc } from "@/lib/api";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || `doc-${Date.now().toString(36)}`;

export default function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [edit, setEdit] = useState<KnowledgeDoc>({ id: "", title: "", body: "", tags: [] });
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.knowledge().then(setDocs).catch((e) => setErr(String(e.message ?? e)));
  useEffect(() => { load(); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try { await api.saveKnowledge({ ...edit, id: edit.id || slug(edit.title) }); setEdit({ id: "", title: "", body: "", tags: [] }); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const remove = async (id: string) => { await api.deleteKnowledge(id); await load(); };
  return (
    <AppShell>
      {() => (
        <main className="container grid grid-2">
          <form onSubmit={save} className="panel stack">
            <h2>{edit.id ? "Edit document" : "Add to the knowledge base"}</h2>
            <p className="small muted" style={{ margin: 0 }}>Everything here is in front of Claude on every call. Price lists, capability statements, FAQs, case studies, compliance answers, objection scripts. Plain text. It will quote figures exactly and never invent one that is not here.</p>
            <input placeholder="Title, e.g. Price list 2026" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required />
            <textarea rows={14} placeholder="Paste the content" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} required />
            <input placeholder="Tags, comma separated (pricing, faq, case-study)" value={(edit.tags ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
            {err && <div className="err">{err}</div>}
            <div className="row"><button className="primary">Save</button>{edit.id && <button type="button" onClick={() => setEdit({ id: "", title: "", body: "", tags: [] })}>Cancel</button>}</div>
          </form>
          <div className="panel">
            <h2>Documents ({docs.length})</h2>
            {docs.length === 0 && <p className="muted small">Nothing yet. Start with your price list and your three best case studies.</p>}
            <div className="list">
              {docs.map((d) => (
                <a key={d.id} href="#" onClick={(e) => { e.preventDefault(); setEdit(d); }}>
                  <span style={{ flex: 1 }}>{d.title} <span className="muted small">{d.body.length.toLocaleString()} chars</span></span>
                  {(d.tags ?? []).map((t) => <span key={t} className="pill">{t}</span>)}
                  <button className="ghost" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(d.id); }}>Remove</button>
                </a>
              ))}
            </div>
          </div>
        </main>
      )}
    </AppShell>
  );
}
