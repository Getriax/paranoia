import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const topicCategoryEnum = pgEnum("topic_category", [
  "relationships",
  "world",
  "hypothetical",
  "personal",
  "creative",
]);

export const topicDifficultyEnum = pgEnum("topic_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const gameStatusEnum = pgEnum("game_status", [
  "lobby",
  "playing",
  "voting",
  "finished",
  "abandoned",
]);

export const topic = pgTable(
  "topic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull(),
    category: topicCategoryEnum("category").notNull(),
    difficulty: topicDifficultyEnum("difficulty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("topic_category_idx").on(t.category),
    index("topic_difficulty_idx").on(t.difficulty),
  ],
);

export const prompt = pgTable(
  "prompt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 128 }).notNull(),
    systemPrompt: text("system_prompt").notNull(),
    jsonSchema: jsonb("json_schema").notNull(),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("prompt_name_version_idx").on(t.name, t.version)],
);

export const game = pgTable(
  "game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomCode: varchar("room_code", { length: 6 }).notNull().unique(),
    topicId: uuid("topic_id").references(() => topic.id, {
      onDelete: "set null",
    }),
    status: gameStatusEnum("status").notNull().default("lobby"),
    totalTurns: integer("total_turns").notNull().default(6),
    currentPlayerId: uuid("current_player_id").references(
      (): AnyPgColumn => player.id,
    ),
    promptId: uuid("prompt_id").references(() => prompt.id),
    model: varchar("model", { length: 128 })
      .notNull()
      .default("deepseek/deepseek-v4-flash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("game_topic_id_idx").on(t.topicId),
    index("game_prompt_id_idx").on(t.promptId),
    index("game_current_player_id_idx").on(t.currentPlayerId),
  ],
);

export const player = pgTable(
  "player",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .references(() => game.id, { onDelete: "cascade" })
      .notNull(),
    displayName: varchar("display_name", { length: 32 }).notNull(),
    position: integer("position"),
    sessionToken: varchar("session_token", { length: 64 })
      .notNull()
      .unique(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull().default("0"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("player_game_id_idx").on(t.gameId)],
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .references(() => game.id, { onDelete: "cascade" })
      .notNull(),
    playerId: uuid("player_id")
      .references(() => player.id)
      .notNull(),
    turnNumber: integer("turn_number").notNull(),
    originalText: text("original_text").notNull(),
    deliveredText: text("delivered_text").notNull(),
    wasModified: boolean("was_modified").notNull().default(false),
    modifierDecision: jsonb("modifier_decision"),
    modifierLatencyMs: integer("modifier_latency_ms"),
    modifierTokensIn: integer("modifier_tokens_in"),
    modifierTokensOut: integer("modifier_tokens_out"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("message_game_id_idx").on(t.gameId),
    index("message_player_id_idx").on(t.playerId),
  ],
);

export const vote = pgTable(
  "vote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .references(() => message.id, { onDelete: "cascade" })
      .notNull(),
    voterPlayerId: uuid("voter_player_id")
      .references(() => player.id)
      .notNull(),
    guess: boolean("guess").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("vote_message_voter_idx").on(t.messageId, t.voterPlayerId),
    index("vote_message_id_idx").on(t.messageId),
    index("vote_voter_player_id_idx").on(t.voterPlayerId),
  ],
);

export const engagementSurvey = pgTable(
  "engagement_survey",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .references(() => game.id, { onDelete: "cascade" })
      .notNull(),
    playerId: uuid("player_id")
      .references(() => player.id)
      .notNull(),
    rating: integer("rating").notNull(),
    wouldReplay: boolean("would_replay").notNull().default(false),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("engagement_survey_game_player_idx").on(t.gameId, t.playerId),
    index("engagement_survey_game_id_idx").on(t.gameId),
    index("engagement_survey_player_id_idx").on(t.playerId),
    check("rating_check", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  ],
);

export const engagementAnalysis = pgTable(
  "engagement_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .references(() => game.id, { onDelete: "cascade" })
      .notNull(),
    score: numeric("score", { precision: 4, scale: 3 }).notNull(),
    dimensions: jsonb("dimensions"),
    reasoning: text("reasoning"),
    model: varchar("model", { length: 128 }),
    promptId: uuid("prompt_id").references(() => prompt.id),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("engagement_analysis_game_idx").on(t.gameId),
    index("engagement_analysis_prompt_id_idx").on(t.promptId),
  ],
);
