import { extractJoinUrl } from "./join-url.js";
import type { CalendarProvider, MeetingEvent, OAuthTokens } from "./types.js";

/**
 * Google Calendar. OAuth client (web application) with scopes
 * calendar.readonly and userinfo.email; redirect URI
 * {PUBLIC_URL}/v1/integrations/calendar/google/callback
 */
export class GoogleCalendar implements CalendarProvider {
  readonly id = "google" as const;
  private readonly scopes = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email";
  constructor(private readonly o: { clientId: string; clientSecret: string; redirectUri: string; fetchImpl?: typeof fetch }) {}

  authorizeUrl(state: string): string {
    const q = new URLSearchParams({ client_id: this.o.clientId, response_type: "code", redirect_uri: this.o.redirectUri, scope: this.scopes, access_type: "offline", prompt: "consent", state });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  private async token(params: Record<string, string>): Promise<OAuthTokens> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.o.clientId, client_secret: this.o.clientSecret, ...params }),
    });
    if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    const tokens: OAuthTokens = { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + (j.expires_in - 60) * 1000 };
    try {
      const me = await f("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (me.ok) tokens.accountEmail = ((await me.json()) as { email?: string }).email?.toLowerCase();
    } catch { /* optional */ }
    return tokens;
  }

  exchangeCode(code: string) { return this.token({ grant_type: "authorization_code", code, redirect_uri: this.o.redirectUri }); }
  refresh(refreshToken: string) { return this.token({ grant_type: "refresh_token", refresh_token: refreshToken }); }

  async listEvents(accessToken: string, fromMs: number, toMs: number): Promise<MeetingEvent[]> {
    const f = this.o.fetchImpl ?? fetch;
    const q = new URLSearchParams({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50" });
    const res = await f(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Google events: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { items: GEvent[] };
    return (j.items ?? []).filter((e) => e.start?.dateTime).map((e) => ({
      id: e.id,
      title: e.summary ?? "(no title)",
      startsAt: Date.parse(e.start!.dateTime!),
      endsAt: Date.parse(e.end?.dateTime ?? e.start!.dateTime!),
      joinUrl: e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? e.hangoutLink ?? extractJoinUrl(e.location, e.description),
      organiserEmail: e.organizer?.email?.toLowerCase(),
      attendeeEmails: (e.attendees ?? []).map((a) => a.email?.toLowerCase()).filter((x): x is string => Boolean(x)),
      isCancelled: e.status === "cancelled",
    }));
  }
}

interface GEvent {
  id: string; summary?: string; status?: string; start?: { dateTime?: string }; end?: { dateTime?: string }; hangoutLink?: string; location?: string; description?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> }; organizer?: { email?: string }; attendees?: Array<{ email?: string }>;
}
