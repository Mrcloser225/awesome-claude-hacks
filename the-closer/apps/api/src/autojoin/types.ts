export type CalendarProviderId = "microsoft" | "google";

export interface CalendarConnection {
  id: string;
  orgId: string;
  userId: string;
  provider: CalendarProviderId;
  accountEmail?: string;
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when accessToken expires. */
  expiresAt: number;
  /** Send a bot to every qualifying meeting automatically. */
  autoJoin: boolean;
  /** Only meetings with at least one attendee outside the user's email domain. */
  externalOnly: boolean;
  /** Participant name the bot joins under. Null means "<user name> (notes)". */
  botName?: string;
}

export interface MeetingEvent {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  joinUrl: string | null;
  organiserEmail?: string;
  attendeeEmails: string[];
  isCancelled: boolean;
}

export interface ScheduledBot {
  eventKey: string;
  connectionId: string;
  callId: string;
  botId: string;
  joinAt: number;
}

export interface CalendarStore {
  listAll(): Promise<CalendarConnection[]>;
  listForUser(userId: string): Promise<CalendarConnection[]>;
  get(id: string): Promise<CalendarConnection | null>;
  save(c: CalendarConnection): Promise<void>;
  delete(id: string): Promise<void>;
  isScheduled(eventKey: string): Promise<boolean>;
  markScheduled(s: ScheduledBot): Promise<void>;
  scheduledForConnection(connectionId: string): Promise<ScheduledBot[]>;
}

export interface OAuthTokens { accessToken: string; refreshToken?: string; expiresAt: number; accountEmail?: string }

/** A calendar we can read meetings from. Microsoft Graph and Google Calendar implement this. */
export interface CalendarProvider {
  id: CalendarProviderId;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  listEvents(accessToken: string, fromMs: number, toMs: number): Promise<MeetingEvent[]>;
}

export class MemoryCalendarStore implements CalendarStore {
  private readonly conns = new Map<string, CalendarConnection>();
  private readonly sched = new Map<string, ScheduledBot>();
  async listAll() { return [...this.conns.values()]; }
  async listForUser(userId: string) { return [...this.conns.values()].filter((c) => c.userId === userId); }
  async get(id: string) { return this.conns.get(id) ?? null; }
  async save(c: CalendarConnection) { this.conns.set(c.id, c); }
  async delete(id: string) { this.conns.delete(id); for (const [k, s] of this.sched) if (s.connectionId === id) this.sched.delete(k); }
  async isScheduled(k: string) { return this.sched.has(k); }
  async markScheduled(s: ScheduledBot) { this.sched.set(s.eventKey, s); }
  async scheduledForConnection(id: string) { return [...this.sched.values()].filter((s) => s.connectionId === id); }
}
