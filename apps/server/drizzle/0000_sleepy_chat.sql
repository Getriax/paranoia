CREATE TYPE "public"."game_status" AS ENUM('lobby', 'playing', 'voting', 'finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."topic_category" AS ENUM('relationships', 'world', 'hypothetical', 'personal', 'creative');--> statement-breakpoint
CREATE TYPE "public"."topic_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE "engagement_survey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_check" CHECK ("engagement_survey"."rating" >= 1 AND "engagement_survey"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" varchar(6) NOT NULL,
	"topic_id" uuid,
	"status" "game_status" DEFAULT 'lobby' NOT NULL,
	"total_turns" integer DEFAULT 6 NOT NULL,
	"current_player_id" uuid,
	"prompt_id" uuid,
	"model" varchar(128) DEFAULT 'deepseek/deepseek-v4-flash' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"turn_number" integer NOT NULL,
	"original_text" text NOT NULL,
	"delivered_text" text NOT NULL,
	"was_modified" boolean DEFAULT false NOT NULL,
	"modifier_decision" jsonb,
	"modifier_latency_ms" integer,
	"modifier_tokens_in" integer,
	"modifier_tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"display_name" varchar(32) NOT NULL,
	"session_token" varchar(64) NOT NULL,
	"score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "prompt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"system_prompt" text NOT NULL,
	"json_schema" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"category" "topic_category" NOT NULL,
	"difficulty" "topic_difficulty" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"voter_player_id" uuid NOT NULL,
	"guess" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_survey" ADD CONSTRAINT "engagement_survey_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_survey" ADD CONSTRAINT "engagement_survey_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_current_player_id_player_id_fk" FOREIGN KEY ("current_player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_voter_player_id_player_id_fk" FOREIGN KEY ("voter_player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engagement_survey_game_player_idx" ON "engagement_survey" USING btree ("game_id","player_id");--> statement-breakpoint
CREATE INDEX "engagement_survey_game_id_idx" ON "engagement_survey" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "engagement_survey_player_id_idx" ON "engagement_survey" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "game_topic_id_idx" ON "game" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "game_prompt_id_idx" ON "game" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "game_current_player_id_idx" ON "game" USING btree ("current_player_id");--> statement-breakpoint
CREATE INDEX "message_game_id_idx" ON "message" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "message_player_id_idx" ON "message" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "player_game_id_idx" ON "player" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_name_version_idx" ON "prompt" USING btree ("name","version");--> statement-breakpoint
CREATE INDEX "topic_category_idx" ON "topic" USING btree ("category");--> statement-breakpoint
CREATE INDEX "topic_difficulty_idx" ON "topic" USING btree ("difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "vote_message_voter_idx" ON "vote" USING btree ("message_id","voter_player_id");--> statement-breakpoint
CREATE INDEX "vote_message_id_idx" ON "vote" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "vote_voter_player_id_idx" ON "vote" USING btree ("voter_player_id");