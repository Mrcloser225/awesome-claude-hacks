import type { CallSummary } from "../coach/summary.js";

export interface CrmAdapter {
  /** Log the call against a contact/opportunity. Returns the CRM record id. */
  logCall(input: { callId: string; prospectEmail?: string; prospectCompany?: string; summary: CallSummary; durationMs: number }): Promise<string>;
}
