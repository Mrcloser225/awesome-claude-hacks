import { useCallback, useEffect, useState } from "react";
import type { CallContext } from "@closer/core";
import { AskBar } from "./components/AskBar";
import { MetricsBar } from "./components/MetricsBar";
import { SayThisCard } from "./components/SayThisCard";
import { TranscriptTicker } from "./components/TranscriptTicker";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useLiveSession } from "./hooks/useLiveSession";

interface Cfg { apiUrl: string; apiKey: string }

export function App() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [clickThrough, setClickThrough] = useState(false);
  const [form, setForm] = useState({ repName: "", company: "", prospectName: "", prospectCompany: "", briefing: "" });
  const [showTranscript, setShowTranscript] = useState(true);

  useEffect(() => {
    if (window.closer) {
      void window.closer.getConfig().then((c) => setCfg({ apiUrl: c.apiUrl, apiKey: c.apiKey }));
      window.closer.onClickThrough(setClickThrough);
    } else {
      setCfg({ apiUrl: import.meta.env.VITE_CLOSER_API_URL ?? "ws://localhost:8787/v1/live", apiKey: import.meta.env.VITE_CLOSER_API_KEY ?? "dev-local-key" });
    }
    try {
      const saved = localStorage.getItem("closer.form");
      if (saved) setForm((f) => ({ ...f, ...(JSON.parse(saved) as Partial<typeof form>) }));
    } catch { /* ignore */ }
  }, []);

  const live = useLiveSession(cfg);
  const onFrame = useCallback((frame: ArrayBuffer) => live.sendAudio(frame), [live.sendAudio]);
  const capture = useAudioCapture(onFrame);

  const start = async () => {
    localStorage.setItem("closer.form", JSON.stringify(form));
    const context: CallContext = {
      callId: `call_${Date.now().toString(36)}`,
      rep: { name: form.repName || "Rep", company: form.company || "Your company" },
      prospect: { name: form.prospectName || undefined, company: form.prospectCompany || undefined },
      briefing: form.briefing || undefined,
    };
    live.connect(context);
    await capture.start();
  };
  const stop = async () => {
    await capture.stop();
    live.disconnect();
  };

  const isLive = live.state.status === "live" || live.state.status === "connecting";

  return (
    <div className={`overlay ${clickThrough ? "click-through" : ""}`}>
      <header className="bar drag">
        <span className="brand">The Closer</span>
        <span className={`status status-${live.state.status}`}>{live.state.status}</span>
        <span className="spacer" />
        <button className="ghost no-drag" onClick={() => setShowTranscript((v) => !v)} title="Toggle transcript">≡</button>
        {isLive
          ? <button className="stop no-drag" onClick={stop}>End</button>
          : <button className="go no-drag" onClick={start} disabled={!cfg}>Go live</button>}
      </header>

      {!isLive && (
        <section className="setup">
          <div className="row">
            <input placeholder="Your name" value={form.repName} onChange={(e) => setForm({ ...form, repName: e.target.value })} />
            <input placeholder="Your company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="row">
            <input placeholder="Prospect name" value={form.prospectName} onChange={(e) => setForm({ ...form, prospectName: e.target.value })} />
            <input placeholder="Prospect company" value={form.prospectCompany} onChange={(e) => setForm({ ...form, prospectCompany: e.target.value })} />
          </div>
          <textarea placeholder="Briefing: goal for this call, history, landmines, what they said last time…" rows={3} value={form.briefing} onChange={(e) => setForm({ ...form, briefing: e.target.value })} />
          <p className="hint">Ctrl/Cmd+Shift+C hides the overlay. Ctrl/Cmd+Shift+X makes it click-through. It is never visible on a screen share.</p>
        </section>
      )}

      {(capture.state.error || live.state.error) && <div className="error">{capture.state.error ?? live.state.error}</div>}

      <SayThisCard card={live.state.card} />

      {isLive && <AskBar onAsk={live.ask} disabled={live.state.status !== "live"} />}
      {isLive && showTranscript && <TranscriptTicker segments={live.state.transcript} />}
      {isLive && <MetricsBar metrics={live.state.metrics} level={capture.state.level} />}

      {capture.state.source && <div className="source">audio: {capture.state.source}</div>}
    </div>
  );
}
