import { useState } from "react";

const QUICK = ["Give me a close", "Handle this objection", "Ask a discovery question", "Summarise what they said"];

export function AskBar({ onAsk, disabled }: { onAsk: (q: string) => void; disabled: boolean }) {
  const [q, setQ] = useState("");
  const submit = (text: string) => {
    if (!text.trim() || disabled) return;
    onAsk(text.trim());
    setQ("");
  };
  return (
    <div className="ask">
      <div className="quick">
        {QUICK.map((x) => (
          <button key={x} disabled={disabled} onClick={() => submit(x)}>{x}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the coach…" disabled={disabled} />
      </form>
    </div>
  );
}
