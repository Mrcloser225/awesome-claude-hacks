import Link from "next/link";
import { Brand } from "@/components/Brand";

const Icon = ({ d }: { d: string }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function Landing() {
  return (
    <main>
      <nav className="nav">
        <Brand />
        <span className="spacer" />
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <Link href="/login" className="btn">Sign in</Link>
        <Link href="/signup" className="btn primary">Start free</Link>
      </nav>

      <section className="hero">
        <div className="glow" /><div className="gridlines" />
        <div className="inner">
          <div className="eyebrow"><span className="tag">New</span> Works with Teams, Zoom and Google Meet</div>
          <h1>Your AI closer,<br /><span className="gradient-text">live on every call.</span></h1>
          <p className="sub">The Closer joins the meeting, listens, and tells you what to say next. It answers what the prospect just asked from your own material, tracks the questions you still need to ask, and writes the follow-up before you have closed the tab.</p>
          <div className="cta-row">
            <Link href="/signup" className="cta">Start free <Icon d="M5 12h14M13 6l6 6-6 6" /></Link>
            <a href="#how" className="cta secondary">See how it works</a>
          </div>
          <p className="fine">No card needed. Bring your own Claude, OpenAI, Gemini or Grok key, or use ours.</p>
        </div>

        <div className="mock">
          <div className="frame">
            <div className="bar"><i /><i /><i /><span>thecloser.ai/app/calls/acme-groundworks</span></div>
            <div className="body">
              <div className="transcript">
                <div className="line rep"><span className="who">You</span>Before we get into it, when is the tender due?</div>
                <div className="line prospect"><span className="who">Sam</span>End of the month. Clarification deadline is next Friday.</div>
                <div className="line rep"><span className="who">You</span>Tight but doable. Which lot are you going for?</div>
                <div className="line prospect"><span className="who">Sam</span>Lot 3, groundworks and piling. We have never bid on a framework before.</div>
                <div className="line prospect"><span className="who">Sam</span>Honestly though, your fees feel too expensive for a first attempt.</div>
                <div className="line prospect partial"><span className="who">Sam</span>and I would need to run it past my director…</div>
              </div>
              <div className="col">
                <div className="card objection">
                  <div className="kicker"><span>Objection</span><span style={{ marginLeft: "auto" }}>pricing</span></div>
                  <div className="headline">Reframe fee against one won lot</div>
                  <div className="script">I hear you, and I would rather you spend nothing than spend it on a bid you cannot win. What is one Lot 3 contract worth to you over the term? That is the number the fee should sit against.</div>
                  <div className="why">Moves the conversation from cost to value and hands the floor back with a question.</div>
                </div>
                <div className="insight">
                  <h3>Ask next <span className="pill">discovery</span></h3>
                  <ul><li>Who signs this off, and when do they need to see it?</li><li>What did the feedback say on the last bid that did not land?</li></ul>
                  <h3>What we know</h3>
                  <ul><li>timeline: due end of month, clarifications next Friday</li><li>experience: first framework bid</li></ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="logos">
          <p>Built for teams selling on</p>
          <div className="row"><span>Microsoft Teams</span><span>Zoom</span><span>Google Meet</span><span>Salesforce</span><span>HubSpot</span><span>Fireflies</span></div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head"><div className="kicker">How it works</div><h2>From meeting link to closed deal.</h2><p>Four steps. The first three take under a minute.</p></div>
        <div className="steps">
          <div className="step"><h3>Paste the link</h3><p>Teams, Zoom or Meet. A participant joins under the name you choose, the same way any notetaker does.</p></div>
          <div className="step"><h3>It listens</h3><p>Every participant transcribed by name in under a second. Your words attributed to you, theirs to them.</p></div>
          <div className="step"><h3>You read, you say</h3><p>The next line appears on your screen the moment the prospect pauses. Objection handling, answers, the best unasked question.</p></div>
          <div className="step"><h3>It closes out</h3><p>Summary, commitments, coaching notes, follow-up email and CRM note, one click after the call ends.</p></div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-head"><div className="kicker">Features</div><h2>Not a note-taker. A second brain in the room.</h2><p>Note-takers tell you what happened. The Closer tells you what to say while the prospect is still thinking.</p></div>
        <div className="grid grid-3">
          <div className="feature"><div className="icon"><Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></div><h3>Live, not after</h3><p>About a second from the prospect finishing a sentence to the first words of your next line. Streamed word by word.</p></div>
          <div className="feature"><div className="icon"><Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" /></div><h3>Answers from your material</h3><p>Load the price list, capability statement and FAQs once. When they ask, the answer is in your mouth, in your voice, and it never invents a number.</p></div>
          <div className="feature"><div className="icon"><Icon d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" /></div><h3>Asks the right questions</h3><p>Every few turns it reads the call: what you know, what you still need, what you owe them an answer to. Quiet moments get your best unasked question.</p></div>
          <div className="feature"><div className="icon"><Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></div><h3>Talk to your AI about the call</h3><p>A private chat beside the transcript. "What is the real objection?" "Draft the close." "Write the follow-up." It has read every word.</p></div>
          <div className="feature"><div className="icon"><Icon d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zM4 22a8 8 0 0 1 16 0" /></div><h3>Any model you want</h3><p>Claude by default. Plug in OpenAI, Gemini, Grok, Qwen, DeepSeek, Mistral, Groq, OpenRouter or your own endpoint. One setting.</p></div>
          <div className="feature"><div className="icon"><Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></div><h3>Private to you</h3><p>What the AI tells you is on your screen only. Imports from Fireflies, pushes to Salesforce and HubSpot. Your data stays yours.</p></div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="section-head"><div className="kicker">Pricing</div><h2>Pays for itself on the first call it saves.</h2><p>Per seat, per month, billed annually. Cancel any time.</p></div>
        <div className="pricing">
          <div className="plan"><h3>Solo</h3><div className="price">£49<small> / seat / month</small></div><ul><li>Unlimited live calls</li><li>Meeting bot for Teams, Zoom, Meet</li><li>Knowledge base and playbook</li><li>Post-call summaries and follow-ups</li><li>Bring your own model key</li></ul><Link href="/signup" className="cta secondary">Start free</Link></div>
          <div className="plan featured"><span className="badge">Most popular</span><h3>Team</h3><div className="price">£89<small> / seat / month</small></div><ul><li>Everything in Solo</li><li>Shared playbooks and objection library</li><li>Manager view: talk ratio, objections handled, suggestions used</li><li>Salesforce and HubSpot sync</li><li>Fireflies import</li><li>Model usage included</li></ul><Link href="/signup" className="cta">Start free</Link></div>
          <div className="plan"><h3>Enterprise</h3><div className="price">Custom</div><ul><li>Everything in Team</li><li>Native Teams bot for locked-down tenants</li><li>SSO, audit log, data residency</li><li>Custom models and private endpoints</li><li>Dedicated success manager</li></ul><a href="mailto:hello@thecloser.ai" className="cta secondary">Talk to us</a></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div className="kicker">FAQ</div><h2>Straight answers.</h2></div>
        <div className="faq">
          <details><summary>Does the prospect know?</summary><p>They see a named participant in the call, the same way they see any notetaker. You choose the name. We recommend a one-line disclosure at the top of the call, which is what every incumbent does and what UK GDPR expects.</p></details>
          <details><summary>How fast is it?</summary><p>About one to two seconds from the prospect finishing a sentence to the first words of your next line. You read it while they are still thinking.</p></details>
          <details><summary>Which AI does it use?</summary><p>Claude by default, because it follows a playbook and a knowledge base precisely. You can switch to OpenAI, Gemini, Grok, Qwen, DeepSeek, Mistral, Groq, OpenRouter, a local Ollama model or any OpenAI-compatible endpoint, with your own key.</p></details>
          <details><summary>Will it make things up?</summary><p>It is told never to invent a number, client or capability that is not in your material or the transcript. If the answer is not there, it gives you an honest holding line. The fix for a wrong answer is a better document, not a prompt tweak.</p></details>
          <details><summary>What about my Fireflies recordings?</summary><p>Paste your Fireflies API key and import any call. It gets the same chat, scoring, follow-up and CRM note as a live call.</p></details>
        </div>
      </section>

      <section className="final">
        <div className="box">
          <h2>Stop losing deals in the pause.</h2>
          <p>Set up in two minutes. Your next call is covered.</p>
          <div className="cta-row"><Link href="/signup" className="cta">Start free <Icon d="M5 12h14M13 6l6 6-6 6" /></Link><Link href="/login" className="cta secondary">Sign in</Link></div>
        </div>
      </section>
      <footer>
        <span className="brand">The Closer</span>
        <span>Built by Glaxtons Consulting, 3 More London Place, London SE1 2RE</span>
        <span>hello@thecloser.ai</span>
      </footer>
    </main>
  );
}
