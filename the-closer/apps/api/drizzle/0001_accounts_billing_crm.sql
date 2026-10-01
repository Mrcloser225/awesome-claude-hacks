CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"role" text,
	"token_hash" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"used_at" bigint,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "crm_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"instance_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" bigint NOT NULL,
	"auto_push" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"org_id" uuid NOT NULL,
	"day" text NOT NULL,
	"metric" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "crm_record_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "seats" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "retention_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "disclosure" text DEFAULT 'chat_message' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "trial_calls_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" bigint;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_org_provider_idx" ON "crm_connections" USING btree ("org_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_pk" ON "usage" USING btree ("org_id","day","metric");