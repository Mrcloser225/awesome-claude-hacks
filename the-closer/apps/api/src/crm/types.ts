import type { CallSummary } from "../coach/summary.js";

export interface CrmPushInput { callId: string; title: string; prospectEmail?: string; prospectName?: string; prospectCompany?: string; summary: CallSummary; durationMs: number; startedAt: number }

export interface CrmAdapter {
  /** Logs the call against the matching contact. Returns the CRM record id and a link if the provider gives one. */
  logCall(input: CrmPushInput): Promise<{ id: string; url?: string }>;
}

export interface CrmOAuthTokens { accessToken: string; refreshToken?: string; expiresAt: number; instanceUrl?: string }

/** OAuth half of a CRM provider: consent URL, code exchange, refresh. */
export interface CrmOAuth {
  provider: "salesforce" | "hubspot";
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<CrmOAuthTokens>;
  refresh(refreshToken: string): Promise<CrmOAuthTokens>;
  adapter(tokens: { accessToken: string; instanceUrl?: string }): CrmAdapter;
}

export function describeCall(i: CrmPushInput): string {
  return [
    i.summary.crmNote,
    "",
    `Outcome: ${i.summary.outcome}`,
    `Next step: ${i.summary.nextStep}`,
    "",
    "Objections:",
    ...i.summary.objectionsRaised.map((o) => `- ${o.objection}: ${o.handled ? "handled" : "not handled"}. ${o.note}`),
    "",
    "Commitments:",
    ...i.summary.commitments.map((c) => `- ${c.owner}: ${c.action}${c.due ? ` (${c.due})` : ""}`),
    "",
    `Logged by The Closer (call ${i.callId})`,
  ].join("\n");
}
