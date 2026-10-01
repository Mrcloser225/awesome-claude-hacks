import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type { CallContext } from "@closer/core";
import { extractJoinUrl } from "../src/autojoin/join-url.js";
import { MicrosoftCalendar } from "../src/autojoin/microsoft.js";
import { GoogleCalendar } from "../src/autojoin/google.js";
import { AutoJoinScheduler } from "../src/autojoin/scheduler.js";
import { MemoryCalendarStore, type CalendarProvider, type MeetingEvent } from "../src/autojoin/types.js";
import { registerCalendarRoutes } from "../src/routes/calendar.js";

describe("join link extraction", () => {
  it("finds Teams, Zoom, Meet and Webex links in invite text", () => {
    expect(extractJoinUrl("Join: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%22Tid%22%3a%22x%22%7d<br>")).toContain("teams.microsoft.com/l/meetup-join/");
    expect(extractJoinUrl(null, "https://us02web.zoom.us/j/123456789?pwd=abc")).toBe("https://us02web.zoom.us/j/123456789?pwd=abc");
    expect(extractJoinUrl("meet.google.com/abc-defg-hij", "https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(extractJoinUrl("Room 4, 3 More London Place")).toBeNull();
  });
});

describe("calendar providers", () => {
  it("maps Microsoft Graph calendarView to meeting events", async () => {
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(String(url)).toContain("/me/calendarView?");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      return new Response(JSON.stringify({ value: [
        { id: "e1", subject: "Discovery with Acme", start: { dateTime: "2026-10-01T10:00:00.0000000" }, end: { dateTime: "2026-10-01T10:30:00.0000000" }, isOnlineMeeting: true, onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/x" }, organizer: { emailAddress: { address: "JP@glaxtons.co.uk" } }, attendees: [{ emailAddress: { address: "sam@acme.com" } }] },
        { id: "e2", subject: "Internal standup", start: { dateTime: "2026-10-01T11:00:00.0000000" }, end: { dateTime: "2026-10-01T11:15:00.0000000" }, bodyPreview: "Zoom: https://zoom.us/j/555", attendees: [{ emailAddress: { address: "richmond@glaxtons.co.uk" } }] },
        { id: "e3", subject: "Lunch", start: { dateTime: "2026-10-01T12:00:00.0000000" }, end: { dateTime: "2026-10-01T13:00:00.0000000" }, location: { displayName: "Borough Market" } },
      ] }));
    };
    const ms = new MicrosoftCalendar({ clientId: "c", clientSecret: "s", redirectUri: "https://api/cb", fetchImpl });
    const events = await ms.listEvents("tok", 0, 1);
    expect(events.map((e) => e.joinUrl)).toEqual(["https://teams.microsoft.com/l/meetup-join/x", "https://zoom.us/j/555", null]);
    expect(events[0]).toMatchObject({ title: "Discovery with Acme", organiserEmail: "jp@glaxtons.co.uk", attendeeEmails: ["sam@acme.com"], startsAt: Date.parse("2026-10-01T10:00:00Z") });
    expect(ms.authorizeUrl("st")).toContain("login.microsoftonline.com/common/oauth2/v2.0/authorize?");
    expect(ms.authorizeUrl("st")).toContain("Calendars.Read");
  });

  it("maps Google Calendar events and exchanges codes", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push(String(url));
      if (String(url).includes("oauth2.googleapis.com/token")) {
        expect(String(init?.body)).toContain("grant_type=authorization_code");
        return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }));
      }
      if (String(url).includes("userinfo")) return new Response(JSON.stringify({ email: "JP@gmail.com" }));
      return new Response(JSON.stringify({ items: [
        { id: "g1", summary: "Demo", status: "confirmed", start: { dateTime: "2026-10-01T15:00:00Z" }, end: { dateTime: "2026-10-01T15:45:00Z" }, conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] }, attendees: [{ email: "buyer@corp.com" }] },
        { id: "g2", summary: "All day", start: { date: "2026-10-01" } },
      ] }));
    };
    const g = new GoogleCalendar({ clientId: "c", clientSecret: "s", redirectUri: "https://api/cb", fetchImpl });
    const t = await g.exchangeCode("code");
    expect(t).toMatchObject({ accessToken: "at", refreshToken: "rt", accountEmail: "jp@gmail.com" });
    const events = await g.listEvents("at", 0, 1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ joinUrl: "https://meet.google.com/abc-defg-hij", attendeeEmails: ["buyer@corp.com"] });
  });
});

function fakeProvider(events: MeetingEvent[], onRefresh?: () => void): CalendarProvider {
  return {
    id: "microsoft",
    authorizeUrl: (s) => `https://fake/authorize?state=${s}`,
    exchangeCode: async () => ({ accessToken: "new", refreshToken: "r2", expiresAt: Date.now() + 3_600_000, accountEmail: "jp@glaxtons.co.uk" }),
    refresh: async () => { onRefresh?.(); return { accessToken: "refreshed", expiresAt: Date.now() + 3_600_000 }; },
    listEvents: async () => events,
  };
}

describe("AutoJoinScheduler", () => {
  it("books a bot once per external meeting with a link, timed before the start", async () => {
    const now = Date.parse("2026-10-01T09:50:00Z");
    const store = new MemoryCalendarStore();
    await store.save({ id: "conn1", orgId: "org1", userId: "u1", provider: "microsoft", accessToken: "tok", refreshToken: "r", expiresAt: now + 3_600_000, autoJoin: true, externalOnly: true });
    const events: MeetingEvent[] = [
      { id: "e1", title: "Discovery with Acme", startsAt: now + 10 * 60_000, endsAt: now + 40 * 60_000, joinUrl: "https://teams.microsoft.com/l/meetup-join/x", organiserEmail: "jp@glaxtons.co.uk", attendeeEmails: ["sam@acme.com"], isCancelled: false },
      { id: "e2", title: "Internal standup", startsAt: now + 5 * 60_000, endsAt: now + 15 * 60_000, joinUrl: "https://zoom.us/j/1", organiserEmail: "jp@glaxtons.co.uk", attendeeEmails: ["richmond@glaxtons.co.uk"], isCancelled: false },
      { id: "e3", title: "No link", startsAt: now + 5 * 60_000, endsAt: now + 15 * 60_000, joinUrl: null, attendeeEmails: ["x@y.com"], isCancelled: false },
      { id: "e4", title: "Cancelled", startsAt: now + 5 * 60_000, endsAt: now + 15 * 60_000, joinUrl: "https://zoom.us/j/2", attendeeEmails: ["x@y.com"], isCancelled: true },
    ];
    const started: Array<{ context: CallContext; meetingUrl: string; botName: string; joinAt: number; title: string }> = [];
    const sched = new AutoJoinScheduler({
      store, providers: { microsoft: fakeProvider(events) }, now: () => now,
      userFor: async () => ({ name: "JP Olivier", company: "Glaxtons", email: "jp@glaxtons.co.uk" }),
      startBot: async (i) => { started.push(i); return { botId: `bot-${started.length}` }; },
    });
    expect(await sched.tick()).toEqual({ scheduled: 1, skipped: 3 });
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ meetingUrl: "https://teams.microsoft.com/l/meetup-join/x", botName: "JP Olivier (notes)", joinAt: now + 9 * 60_000, title: "Discovery with Acme" });
    expect(started[0]!.context.prospect).toMatchObject({ company: "acme" });
    expect(started[0]!.context.rep).toEqual({ name: "JP Olivier", company: "Glaxtons" });
    // Second tick: nothing new, nothing double-booked.
    expect(await sched.tick()).toEqual({ scheduled: 0, skipped: 4 });
    expect(started).toHaveLength(1);

    const preview = await sched.preview((await store.get("conn1"))!);
    expect(preview.map((p) => [p.id, p.eligible, p.scheduled, p.reason])).toEqual([["e1", true, true, undefined], ["e2", false, false, "internal meeting"], ["e3", false, false, "no join link"], ["e4", false, false, "cancelled"]]);
  });

  it("refreshes an expiring token before reading the calendar, and honours auto-join off and custom bot names", async () => {
    const now = Date.now();
    let refreshed = 0;
    const store = new MemoryCalendarStore();
    await store.save({ id: "c", orgId: "o", userId: "u", provider: "microsoft", accessToken: "old", refreshToken: "r", expiresAt: now + 30_000, autoJoin: true, externalOnly: false, botName: "Emma Ballentine" });
    const started: string[] = [];
    const ev: MeetingEvent = { id: "e", title: "Call", startsAt: now + 60_000, endsAt: now + 120_000, joinUrl: "https://zoom.us/j/9", attendeeEmails: [], isCancelled: false };
    const sched = new AutoJoinScheduler({ store, providers: { microsoft: fakeProvider([ev], () => refreshed++) }, now: () => now, userFor: async () => ({ name: "JP", company: "G" }), startBot: async (i) => { started.push(i.botName); return { botId: "b" }; } });
    await sched.tick();
    expect(refreshed).toBe(1);
    expect((await store.get("c"))!.accessToken).toBe("refreshed");
    expect(started).toEqual(["Emma Ballentine"]);

    const conn = (await store.get("c"))!; conn.autoJoin = false; await store.save(conn);
    await store.save({ id: "c2", orgId: "o", userId: "u", provider: "microsoft", accessToken: "t", expiresAt: now + 3_600_000, autoJoin: true, externalOnly: false });
    const r = await sched.tick();
    expect(r.scheduled).toBe(1); // c2 books the same event under its own key; c is off
    expect(started).toHaveLength(2);
  });
});

describe("calendar routes", () => {
  it("issues a consent URL, accepts the callback with signed state, and lets the user tune settings", async () => {
    const store = new MemoryCalendarStore();
    const provider = fakeProvider([]);
    const app = Fastify();
    app.addHook("preHandler", async (req) => { (req as unknown as { principal: unknown }).principal = { userId: "u1", orgId: "org1", name: "JP", company: "G" }; });
    const scheduler = new AutoJoinScheduler({ store, providers: { microsoft: provider }, userFor: async () => null, startBot: async () => ({ botId: "x" }) });
    registerCalendarRoutes(app, { store, providers: { microsoft: provider }, scheduler, stateSecret: "s", webUrl: "https://thecloser.ai" });

    const connect = await app.inject({ method: "GET", url: "/v1/integrations/calendar/microsoft/connect" });
    const url = (connect.json() as { url: string }).url;
    const state = new URL(url).searchParams.get("state")!;
    expect(state.split(".")).toHaveLength(3);
    const google = await app.inject({ method: "GET", url: "/v1/integrations/calendar/google/connect" });
    expect(google.statusCode).toBe(501);

    const cb = await app.inject({ method: "GET", url: `/v1/integrations/calendar/microsoft/callback?code=abc&state=${state}` });
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toBe("https://thecloser.ai/app/settings?calendar=connected:microsoft");
    const bad = await app.inject({ method: "GET", url: `/v1/integrations/calendar/microsoft/callback?code=abc&state=forged` });
    expect(bad.headers.location).toContain("error:bad_state");

    const list = await app.inject({ method: "GET", url: "/v1/integrations/calendar" });
    const [conn] = list.json() as Array<{ id: string; accountEmail: string; autoJoin: boolean; accessToken?: string }>;
    expect(conn).toMatchObject({ accountEmail: "jp@glaxtons.co.uk", autoJoin: true });
    expect(conn!.accessToken).toBeUndefined();

    const patched = await app.inject({ method: "PATCH", url: `/v1/integrations/calendar/${conn!.id}`, payload: { autoJoin: false, botName: "Emma Ballentine" } });
    expect(patched.json()).toMatchObject({ autoJoin: false, botName: "Emma Ballentine" });
    const del = await app.inject({ method: "DELETE", url: `/v1/integrations/calendar/${conn!.id}` });
    expect(del.statusCode).toBe(204);
    expect(await store.listForUser("u1")).toEqual([]);
  });
});
