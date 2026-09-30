import type { Playbook } from "./types.js";

/**
 * A worked example playbook. Tenants replace this with their own via the API.
 * Numbers here are the canonical Glaxtons figures.
 */
export const GLAXTONS_PLAYBOOK: Playbook = {
  id: "glaxtons-bid-consultancy",
  name: "Glaxtons bid consultancy",
  company: "Glaxtons Consulting",
  product: "Bid writing, framework readiness and retained business development for firms competing for public and private sector contracts",
  positioning:
    "A bid partner, not just a writer. We qualify hard, write to the evaluator's criteria using the client's own evidence, and leave them with a bid library they own.",
  idealCustomer:
    "UK SMEs competing for framework lots against larger firms, and Tier 1 contractors with more tenders than their bid team can absorb. Construction, civils, FM, healthcare, social care, rail, highways, utilities, security, tech.",
  valueProps: [
    "93% success rate across 500+ submissions 2022 to 2025 against an industry average of 60 to 75%",
    "£500M+ of contracts won for clients",
    "100% success on Pagabo and G-Cloud framework applications",
    "91% of clients come back for the next bid",
    "Fixed fees agreed before work starts; no surprises on scope",
    "Honest bid or no-bid call before the client commits resource",
  ],
  proofPoints: [
    "4.9 out of 5 from 347 verified reviews",
    "Frameworks supported include CWAS3 (RM6320), Pagabo Major Works, Pagabo Civil Engineering, NHS SBS Construction, G-Cloud 15, Department for Transport and Department for Education",
    "Office at 3 More London Place, London SE1 2RE",
  ],
  discoveryQuestions: [
    "What is the deadline, including the clarification cut-off?",
    "Which lot or region are you looking at, and why that one?",
    "What did the feedback say on the last bid that did not land?",
    "Who writes your bids today and how much of their week does it take?",
    "What would winning this contract change for the business over the next 12 months?",
    "Is there a framework you need to be on that you are not on yet?",
  ],
  objections: [
    { trigger: "too expensive", response: "Acknowledge, then reframe against the value of one won contract and the cost of the management time a failed bid burns. Offer the fixed-fee review as a lower-commitment first step." },
    { trigger: "we write bids in-house", response: "Agree that in-house knowledge is the asset. Position Glaxtons as the evaluator-side review and the capacity for peaks, not a replacement. Ask what their last three scores were." },
    { trigger: "send me some information", response: "Agree, then ask for the deadline and the lot so the information is specific. Book the next call before ending this one." },
    { trigger: "we already use another consultancy", response: "Ask what their success rate has been. Offer an independent mock assessment on the next draft so they can compare on evidence." },
    { trigger: "not the right time", response: "Ask when the next framework window or tender is due. Offer the readiness audit now so they are not scrambling when it opens." },
    { trigger: "need to check with my director", response: "Offer to join that conversation or to send a one-page summary tailored to the director. Agree a date to reconvene." },
  ],
  competitors: [
    { name: "Large bid consultancies", counter: "Directors write the bids here, not juniors. Fixed fees, not day rates." },
    { name: "Freelance bid writers", counter: "One person cannot cover readiness, pricing strategy and writing on a live tender. We bring the full team with a single fixed fee." },
  ],
  stageGuides: {
    opening: "Confirm the deadline and the lot in the first two minutes. Set the agenda: qualify, plan, then decide together.",
    discovery: "Get previous scores and feedback. Find the compliance gaps before talking about writing.",
    pitch: "Tie every claim to the evaluator's criteria. Use one proof point per claim, not all of them.",
    objection: "Acknowledge, reframe, ask. Never discount on the call.",
    pricing: "Fixed fee, 50% on instruction and 50% on submission. Readiness work is quoted separately from bid management.",
    close: "Ask for the tender documents and propose a kick-off date. Book a call at bookings.glaxtons.co.uk.",
    next_steps: "Summarise the three things agreed, who owns each, and the date of the next contact.",
  },
  tone: "Senior practitioner. Direct, warm, no jargon, no hype. UK English.",
  guardrails: [
    "Never quote a discount.",
    "Never name other clients; only public framework names.",
    "Never promise a win. Talk about success rate and process.",
    "Never invent a statistic that is not listed above.",
  ],
};
