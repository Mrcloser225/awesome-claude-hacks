import { describeCall, type CrmAdapter, type CrmOAuth, type CrmOAuthTokens, type CrmPushInput } from "./types.js";

/**
 * HubSpot: public app OAuth (scopes crm.objects.contacts.read,
 * crm.objects.contacts.write, crm.objects.calls.write, or the equivalent
 * engagement scopes). Creates a Call engagement associated with the contact.
 */
export class HubSpotOAuth implements CrmOAuth {
  readonly provider = "hubspot" as const;
  constructor(private readonly o: { clientId: string; clientSecret: string; redirectUri: string; fetchImpl?: typeof fetch }) {}
  authorizeUrl(state: string) {
    const q = new URLSearchParams({ client_id: this.o.clientId, redirect_uri: this.o.redirectUri, scope: "crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read oauth", state });
    return `https://app.hubspot.com/oauth/authorize?${q}`;
  }
  private async token(form: Record<string, string>): Promise<CrmOAuthTokens> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f("https://api.hubapi.com/oauth/v1/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: this.o.clientId, client_secret: this.o.clientSecret, redirect_uri: this.o.redirectUri, ...form }) });
    if (!res.ok) throw new Error(`HubSpot token: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + (j.expires_in - 60) * 1000 };
  }
  exchangeCode(code: string) { return this.token({ grant_type: "authorization_code", code }); }
  refresh(refreshToken: string) { return this.token({ grant_type: "refresh_token", refresh_token: refreshToken }); }
  adapter(t: { accessToken: string }): CrmAdapter { return new HubSpotAdapter({ accessToken: t.accessToken, fetchImpl: this.o.fetchImpl }); }
}

export class HubSpotAdapter implements CrmAdapter {
  constructor(private readonly o: { accessToken: string; fetchImpl?: typeof fetch }) {}
  private async hs<T>(path: string, init: RequestInit = {}): Promise<T> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`https://api.hubapi.com${path}`, { ...init, headers: { Authorization: `Bearer ${this.o.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }
  async logCall(i: CrmPushInput) {
    let contactId: string | undefined;
    if (i.prospectEmail) {
      const r = await this.hs<{ results: Array<{ id: string }> }>("/crm/v3/objects/contacts/search", { method: "POST", body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: i.prospectEmail }] }], limit: 1 }) });
      contactId = r.results[0]?.id;
    }
    const call = await this.hs<{ id: string }>("/crm/v3/objects/calls", {
      method: "POST",
      body: JSON.stringify({
        properties: { hs_timestamp: String(i.startedAt), hs_call_title: `Call: ${i.summary.oneLine}`.slice(0, 255), hs_call_body: describeCall(i), hs_call_duration: String(i.durationMs), hs_call_status: "COMPLETED", hs_call_direction: "OUTBOUND" },
        ...(contactId ? { associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 194 }] }] } : {}),
      }),
    });
    return { id: call.id };
  }
}
