import { describeCall, type CrmAdapter, type CrmOAuth, type CrmOAuthTokens, type CrmPushInput } from "./types.js";

/**
 * Salesforce: Connected App with OAuth web server flow (scopes: api,
 * refresh_token, offline_access). Logs a completed Task of type Call on the
 * matching Contact, falling back to a Lead by email.
 */
export class SalesforceOAuth implements CrmOAuth {
  readonly provider = "salesforce" as const;
  constructor(private readonly o: { clientId: string; clientSecret: string; redirectUri: string; loginUrl?: string; fetchImpl?: typeof fetch }) {}
  private get login() { return this.o.loginUrl ?? "https://login.salesforce.com"; }
  authorizeUrl(state: string) {
    const q = new URLSearchParams({ response_type: "code", client_id: this.o.clientId, redirect_uri: this.o.redirectUri, scope: "api refresh_token offline_access", state });
    return `${this.login}/services/oauth2/authorize?${q}`;
  }
  private async token(form: Record<string, string>): Promise<CrmOAuthTokens> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.login}/services/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: this.o.clientId, client_secret: this.o.clientSecret, ...form }) });
    if (!res.ok) throw new Error(`Salesforce token: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { access_token: string; refresh_token?: string; instance_url: string };
    // Salesforce access tokens live for the session timeout (default 2 hours); refresh proactively.
    return { accessToken: j.access_token, refreshToken: j.refresh_token, instanceUrl: j.instance_url, expiresAt: Date.now() + 90 * 60_000 };
  }
  exchangeCode(code: string) { return this.token({ grant_type: "authorization_code", code, redirect_uri: this.o.redirectUri }); }
  refresh(refreshToken: string) { return this.token({ grant_type: "refresh_token", refresh_token: refreshToken }); }
  adapter(t: { accessToken: string; instanceUrl?: string }): CrmAdapter {
    if (!t.instanceUrl) throw new Error("Salesforce connection has no instance URL");
    return new SalesforceAdapter({ instanceUrl: t.instanceUrl, accessToken: t.accessToken, fetchImpl: this.o.fetchImpl });
  }
}

export class SalesforceAdapter implements CrmAdapter {
  constructor(private readonly o: { instanceUrl: string; accessToken: string; apiVersion?: string; fetchImpl?: typeof fetch }) {}
  private get base() { return `${this.o.instanceUrl}/services/data/v${this.o.apiVersion ?? "61.0"}`; }
  private async sf<T>(path: string, init: RequestInit = {}): Promise<T> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.base}${path}`, { ...init, headers: { Authorization: `Bearer ${this.o.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`Salesforce ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
  async logCall(i: CrmPushInput) {
    let whoId: string | undefined;
    if (i.prospectEmail) {
      const email = i.prospectEmail.replace(/'/g, "\\'");
      const c = await this.sf<{ records: Array<{ Id: string }> }>(`/query?q=${encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${email}' LIMIT 1`)}`);
      whoId = c.records[0]?.Id;
      if (!whoId) {
        const l = await this.sf<{ records: Array<{ Id: string }> }>(`/query?q=${encodeURIComponent(`SELECT Id FROM Lead WHERE Email = '${email}' AND IsConverted = false LIMIT 1`)}`);
        whoId = l.records[0]?.Id;
      }
    }
    const created = await this.sf<{ id: string }>(`/sobjects/Task`, {
      method: "POST",
      body: JSON.stringify({ Subject: `Call: ${i.summary.oneLine}`.slice(0, 255), Type: "Call", Status: "Completed", TaskSubtype: "Call", ActivityDate: new Date(i.startedAt).toISOString().slice(0, 10), CallDurationInSeconds: Math.round(i.durationMs / 1000), Description: describeCall(i), ...(whoId ? { WhoId: whoId } : {}) }),
    });
    return { id: created.id, url: `${this.o.instanceUrl}/${created.id}` };
  }
}
