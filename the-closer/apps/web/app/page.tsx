import Link from "next/link";

export default function Landing() {
  return (
    <main>
      <nav className="nav">
        <span className="brand">The Closer</span>
        <span className="spacer" />
        <Link href="/login">Sign in</Link>
        <Link href="/signup" className="cta secondary" style={{ padding: "8px 14px" }}>Start free</Link>
      </nav>
      <section className="hero">
        <h1>Claude on your sales calls.</h1>
        <p>The Closer joins your Teams, Zoom or Meet call, listens, and works the call with you. The next line to say. The answer to what the prospect just asked, from your own material. The qualifying question you have not asked yet. Then the summary, the follow-up and the CRM note before you have closed the window.</p>
        <p><Link href="/signup" className="cta">Start free</Link><Link href="/login" className="cta secondary">Sign in</Link></p>
      </section>
      <section className="features grid grid-3">
        <div className="panel feature"><h3>Live, not after</h3><p>Note-takers tell you what happened. The Closer tells you what to say while the prospect is still thinking, about a second after they stop talking.</p></div>
        <div className="panel feature"><h3>Answers from your material</h3><p>Load your price list, capability statement and FAQs once. When the prospect asks, the answer is in your mouth in your voice, and it never invents a number.</p></div>
        <div className="panel feature"><h3>Asks the right questions</h3><p>Every few turns it reads the call: what you know, what you still need, what you owe them an answer to. Quiet moments get your best unasked question, not filler.</p></div>
        <div className="panel feature"><h3>Talk to Claude about the call</h3><p>A private chat beside the transcript. "What is the real objection?" "Draft the close." "Write the follow-up." It has read every word.</p></div>
        <div className="panel feature"><h3>Bring your Fireflies calls</h3><p>Import the transcripts you already have and work them the same way: objections missed, coaching notes, follow-ups written.</p></div>
        <div className="panel feature"><h3>Private to you</h3><p>The prospect sees a named participant, the same way they see any notetaker. What Claude tells you is on your screen only.</p></div>
      </section>
      <footer>The Closer. Built by Glaxtons Consulting, 3 More London Place, London SE1 2RE.</footer>
    </main>
  );
}
