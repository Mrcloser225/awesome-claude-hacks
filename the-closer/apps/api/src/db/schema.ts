import { bigint, boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"), // trial | solo | team | enterprise
  seats: integer("seats").notNull().default(1),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** Calls older than this are purged by the nightly job. 0 = keep forever. */
  retentionDays: integer("retention_days").notNull().default(0),
  /** How the bot discloses itself: chat_message (posts a notice in the meeting chat), name_only, off. */
  disclosure: text("disclosure").notNull().default("chat_message"),
  trialCallsUsed: integer("trial_calls_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull().default("rep"), // rep | manager | admin
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: bigint("email_verified_at", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One-time tokens for email verification, password reset and invitations. Only the hash is stored. */
export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  userId: uuid("user_id"),
  email: text("email").notNull(),
  kind: text("kind").notNull(), // verify | reset | invite
  role: text("role"),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  usedAt: bigint("used_at", { mode: "number" }),
});

/** Salesforce or HubSpot connection for an org. Tokens are encrypted at rest. */
export const crmConnections = pgTable("crm_connections", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  provider: text("provider").notNull(), // salesforce | hubspot
  instanceUrl: text("instance_url"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  autoPush: boolean("auto_push").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("crm_org_provider_idx").on(t.orgId, t.provider)]);

/** Daily usage counters per org, for quotas and metered billing. */
export const usage = pgTable("usage", {
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  day: text("day").notNull(), // YYYY-MM-DD UTC
  metric: text("metric").notNull(), // coach_calls | chat_turns | bots | summaries
  count: integer("count").notNull().default(0),
}, (t) => [uniqueIndex("usage_pk").on(t.orgId, t.day, t.metric)]);

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
  userId: uuid("user_id"),
  crmRecordId: text("crm_record_id"),
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
