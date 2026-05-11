-- Idempotent drift fix: brings DBs created from 0000_sleepy_chat.sql up to
-- the current schema. Safe to apply to a fresh DB, a partially-patched dev DB,
-- or one already at the target shape.

ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "position" integer;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

ALTER TABLE "engagement_survey" ADD COLUMN IF NOT EXISTS "would_replay" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_survey" ADD COLUMN IF NOT EXISTS "comment" text;--> statement-breakpoint
ALTER TABLE "engagement_survey" DROP COLUMN IF EXISTS "feedback";--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "engagement_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"score" numeric(4, 3) NOT NULL,
	"dimensions" jsonb,
	"reasoning" text,
	"model" varchar(128),
	"prompt_id" uuid,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "engagement_analysis" ADD CONSTRAINT "engagement_analysis_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "engagement_analysis" ADD CONSTRAINT "engagement_analysis_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "engagement_analysis_game_idx" ON "engagement_analysis" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_analysis_prompt_id_idx" ON "engagement_analysis" USING btree ("prompt_id");
