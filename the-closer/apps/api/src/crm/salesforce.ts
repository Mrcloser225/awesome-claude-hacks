import type { CrmAdapter } from "./types.js";

/**
 * Minimal Salesforce adapter using the REST API directly: creates a Task
 * (Type = Call) with the CRM note and links it to a Contact when one matches
 * the prospect's email. Swap the token source for a Connected App OAuth flow
 * per tenant in production.
 */
export class SalesforceAdapter implements CrmAdapter {
  constructor(private readonly opts: { instanceUrl: string; accessToken: string; apiVersion?: string; fetchImpl?: typeof fetch }) {}

  private get base(): string {
    return `${this.opts.instanceUrl}/services/data/v${this.opts.apiVersion ?? "61.0"}`;
  }

  private async sf<T>(path: string, init: RequestInit = {}): Promise<T> {
    const f = this.opts.fetchImpl ?? fetch;
    const res = await f(`${this.base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.opts.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Salesforce ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  async logCall(input: Parameters<CrmAdapter["logCall"]>[0]): Promise<string> {
    let whoId: string | undefined;
    if (input.prospectEmail) {
      const q = encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${input.prospectEmail.replace(/'/g, "\\'")}' LIMIT 1`);
      const r = await this.sf<{ records: Array<{ Id: string }> }>(`/query?q=${q}`);
      whoId = r.records[0]?.Id;
    }
    const body = {
      Subject: `Call: ${input.summary.oneLine}`.slice(0, 255),
      Type: "Call",
      Status: "Completed",
      TaskSubtype: "Call",
      CallDurationInSeconds: Math.round(input.durationMs / 1000),
      Description: [
        input.summary.crmNote,
        "",
        `Outcome: ${input.summary.outcome}`,
        `Next step: ${input.summary.nextStep}`,
        "",
        "Commitments:",
        ...input.summary.commitments.map((c) => `- ${c.owner}: ${c.action}${c.due ? ` (${c.due})` : ""}`),
        "",
        `Logged by The Closer (call ${input.callId})`,
      ].join("\n"),
      ...(whoId ? { WhoId: whoId } : {}),
    };
    const created = await this.sf<{ id: string }>(`/sobjects/Task`, { method: "POST", body: JSON.stringify(body) });
    return created.id;
  }
}
