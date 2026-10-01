import { bigint, boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull().default("rep"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  userId: uuid("user_id").references(() => users.id),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playbooks = pgTable("playbooks", {
  id: text("id").notNull(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  body: jsonb("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("playbooks_org_id_idx").on(t.orgId, t.id)]);

export const knowledge = pgTable("knowledge", {
  id: text("id").notNull(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("knowledge_org_id_idx").on(t.orgId, t.id)]);

/** One row per call, live or finished. Transcript and events are JSON: a call is read and written whole. */
export const calls = pgTable("calls", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  title: text("title").notNull(),
  source: text("source").notNull(),
  externalId: text("external_id"),
  context: jsonb("context").notNull(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  endedAt: bigint("ended_at", { mode: "number" }),
  transcript: jsonb("transcript").notNull().default([]),
  events: jsonb("events").notNull().default([]),
  insight: jsonb("insight"),
  summary: jsonb("summary"),
  repTalkRatio: real("rep_talk_ratio"),
  objectionsRaised: integer("objections_raised"),
}, (t) => [index("calls_org_started_idx").on(t.orgId, t.startedAt)]);

/** A connected Microsoft 365 or Google calendar, for Fireflies-style auto-join. */
export const calendarConnections = pgTable("calendar_connections", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // microsoft | google
  accountEmail: text("account_email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  autoJoin: boolean("auto_join").notNull().default(true),
  externalOnly: boolean("external_only").notNull().default(true),
  botName: text("bot_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("calendar_user_idx").on(t.userId)]);

/** Bots already requested for calendar events, so a meeting is never joined twice. */
export const scheduledBots = pgTable("scheduled_bots", {
  eventKey: text("event_key").primaryKey(), // `${connectionId}:${eventId}`
  connectionId: uuid("connection_id").notNull().references(() => calendarConnections.id),
  callId: text("call_id").notNull(),
  botId: text("bot_id").notNull(),
  joinAt: bigint("join_at", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
