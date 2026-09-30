import { boolean, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("trial"), // trial | team | enterprise
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("rep"), // rep | manager | admin
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  userId: uuid("user_id").references(() => users.id),
  /** sha256 of the key; the plaintext is shown once at creation. */
  keyHash: text("key_hash").notNull().unique(),
  label: text("label"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playbooks = pgTable("playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  /** Full Playbook JSON as defined in @closer/core. */
  body: jsonb("body").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  playbookId: uuid("playbook_id").references(() => playbooks.id),
  source: text("source").notNull(), // desktop | recall | teams_bot
  externalMeetingId: text("external_meeting_id"),
  context: jsonb("context").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  repTalkRatio: real("rep_talk_ratio"),
  objectionsRaised: integer("objections_raised"),
});

export const transcriptSegments = pgTable("transcript_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").notNull().references(() => calls.id),
  speaker: text("speaker").notNull(),
  participant: text("participant"),
  text: text("text").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  confidence: real("confidence"),
});

export const coachEvents = pgTable("coach_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").notNull().references(() => calls.id),
  type: text("type").notNull(),
  priority: integer("priority").notNull(),
  headline: text("headline").notNull(),
  script: text("script").notNull(),
  rationale: text("rationale"),
  stage: text("stage"),
  /** Set when the rep marks the suggestion as used / ignored in the overlay. */
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const callSummaries = pgTable("call_summaries", {
  callId: uuid("call_id").primaryKey().references(() => calls.id),
  body: jsonb("body").notNull(),
  pushedToCrmAt: timestamp("pushed_to_crm_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
