import { extractJoinUrl } from "./join-url.js";
import type { CalendarProvider, MeetingEvent, OAuthTokens } from "./types.js";

/**
 * Microsoft 365 calendar through Microsoft Graph, delegated permissions.
 * App registration needs: Calendars.Read, User.Read, offline_access.
 * Redirect URI: {PUBLIC_URL}/v1/integrations/calendar/microsoft/callback
 */
export class MicrosoftCalendar implements CalendarProvider {
  readonly id = "microsoft" as const;
  private readonly scopes = "offline_access User.Read Calendars.Read";
  constructor(private readonly o: { clientId: string; clientSecret: string; tenant?: string; redirectUri: string; fetchImpl?: typeof fetch }) {}

  private get authority() { return `https://login.microsoftonline.com/${this.o.tenant ?? "common"}/oauth2/v2.0`; }

  authorizeUrl(state: string): string {
    const q = new URLSearchParams({ client_id: this.o.clientId, response_type: "code", redirect_uri: this.o.redirectUri, response_mode: "query", scope: this.scopes, state, prompt: "select_account" });
    return `${this.authority}/authorize?${q}`;
  }

  private async token(params: Record<string, string>): Promise<OAuthTokens> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.authority}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.o.clientId, client_secret: this.o.clientSecret, scope: this.scopes, ...params }),
    });
    if (!res.ok) throw new Error(`Microsoft token: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    const tokens: OAuthTokens = { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + (j.expires_in - 60) * 1000 };
    try {
      const me = await f("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (me.ok) { const u = (await me.json()) as { mail?: string; userPrincipalName?: string }; tokens.accountEmail = (u.mail ?? u.userPrincipalName)?.toLowerCase(); }
    } catch { /* email is a nicety */ }
    return tokens;
  }

  exchangeCode(code: string) { return this.token({ grant_type: "authorization_code", code, redirect_uri: this.o.redirectUri }); }
  refresh(refreshToken: string) { return this.token({ grant_type: "refresh_token", refresh_token: refreshToken }); }

  async listEvents(accessToken: string, fromMs: number, toMs: number): Promise<MeetingEvent[]> {
    const f = this.o.fetchImpl ?? fetch;
    const q = new URLSearchParams({ startDateTime: new Date(fromMs).toISOString(), endDateTime: new Date(toMs).toISOString(), $orderby: "start/dateTime", $top: "50", $select: "id,subject,start,end,isCancelled,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,location,bodyPreview,organizer,attendees" });
    const res = await f(`https://graph.microsoft.com/v1.0/me/calendarView?${q}`, { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' } });
    if (!res.ok) throw new Error(`Graph calendarView: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { value: GraphEvent[] };
    return j.value.map((e) => ({
      id: e.id,
      title: e.subject ?? "(no title)",
      startsAt: Date.parse(e.start.dateTime.endsWith("Z") ? e.start.dateTime : `${e.start.dateTime}Z`),
      endsAt: Date.parse(e.end.dateTime.endsWith("Z") ? e.end.dateTime : `${e.end.dateTime}Z`),
      joinUrl: e.onlineMeeting?.joinUrl ?? e.onlineMeetingUrl ?? extractJoinUrl(e.location?.displayName, e.bodyPreview),
      organiserEmail: e.organizer?.emailAddress?.address?.toLowerCase(),
      attendeeEmails: (e.attendees ?? []).map((a) => a.emailAddress?.address?.toLowerCase()).filter((x): x is string => Boolean(x)),
      isCancelled: Boolean(e.isCancelled),
    }));
  }
}

interface GraphEvent {
  id: string; subject?: string; start: { dateTime: string }; end: { dateTime: string }; isCancelled?: boolean;
  onlineMeeting?: { joinUrl?: string } | null; onlineMeetingUrl?: string | null; location?: { displayName?: string }; bodyPreview?: string;
  organizer?: { emailAddress?: { address?: string } }; attendees?: Array<{ emailAddress?: { address?: string } }>;
}
