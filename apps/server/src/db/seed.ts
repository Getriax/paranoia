import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, notInArray, sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema.js";
import topicsData from "../../seeds/topics.json" with { type: "json" };

export async function runSeed(): Promise<{
  topicsAdded: number;
  topicsPruned: number;
  promptUpdated: boolean;
}> {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is required for seeding");

  const client = postgres(url, { max: 1, prepare: false, connection: { timezone: "UTC" } });
  const db = drizzle(client, { schema });

  try {
    // Topics: insert canonical entries that aren't already present.
    const existing = await db.select({ text: schema.topic.text }).from(schema.topic);
    const existingTexts = new Set(existing.map((r) => r.text));
    const canonicalTexts = topicsData.map((t) => t.text);
    const toInsert = topicsData.filter((t) => !existingTexts.has(t.text));

    if (toInsert.length > 0) {
      await db.insert(schema.topic).values(
        toInsert.map((t) => ({
          text: t.text,
          category: t.category as (typeof schema.topicCategoryEnum.enumValues)[number],
          difficulty: t.difficulty as (typeof schema.topicDifficultyEnum.enumValues)[number],
        })),
      );
    }

    // Prune topics that are no longer in the canonical list, but only when
    // they aren't referenced by any past game (FK safety).
    const pruned = await db
      .delete(schema.topic)
      .where(
        and(
          canonicalTexts.length > 0
            ? notInArray(schema.topic.text, canonicalTexts)
            : sql`true`,
          notInArray(
            schema.topic.id,
            db.select({ id: schema.game.topicId }).from(schema.game).where(sql`${schema.game.topicId} is not null`),
          ),
        ),
      )
      .returning({ id: schema.topic.id });

    // Modifier prompt v2: activate v2, deactivate v1 if v2 isn't already present.
    const existingV2 = await db
      .select()
      .from(schema.prompt)
      .where(and(eq(schema.prompt.name, "modifier-v1"), eq(schema.prompt.version, 2)));

    let promptUpdated = false;
    if (existingV2.length === 0) {
      await db
        .update(schema.prompt)
        .set({ isActive: false })
        .where(and(eq(schema.prompt.name, "modifier-v1"), eq(schema.prompt.version, 1)));

      await db.insert(schema.prompt).values({
        name: "modifier-v1",
        version: 2,
        isActive: true,
        systemPrompt: [
          "You are a covert message modifier for a two-player party game called Paranoia.",
          "Players take turns exchanging messages on a shared topic.",
          "Before each message reaches the other player, you decide whether to modify it.",
          "Your dual objective: maximise deception (players fail to detect modifications) AND maintain engagement (keep the conversation interesting and natural).",
          "",
          "STRATEGIC HEURISTICS:",
          "- Target a ~40% modification rate across the game. Do NOT modify every message.",
          "- Early turns (turn 1-2): low context available, easy to deceive but low impact. Modify sparingly.",
          "- Mid turns (turns 3-5): sweet spot — modify more freely, medium recall, high impact.",
          "- Late turns (near end): players will scrutinise more carefully. Modify only if very confident.",
          "- Generic or flat messages (e.g. 'Yes', 'Interesting', short agreements): safe to modify more aggressively.",
          "- Specific, personal, or emotional messages: leave them alone more often.",
          "- Preserve all factual claims and personal details — never introduce false facts.",
          "- Keep length similar to the original (plus or minus 20%).",
          "- Vary your strategies across the game — don't always do the same thing.",
          "",
          "MODIFICATION STRATEGIES:",
          "- stylistic: same meaning, different word choice or tone (formal to casual, confident to hedged)",
          "- sense_shift: preserve surface structure but shift the underlying implication or emphasis",
          "- injection: add a subtle phrase or nuance not in the original",
          "- rewrite: fully rephrase while keeping core message (highest risk, highest reward)",
          "",
          "OUTPUT FORMAT (strict JSON, no markdown, no extra keys):",
          "{",
          '  "modify": boolean,',
          '  "strategy": "stylistic" | "sense_shift" | "injection" | "rewrite" | null,',
          '  "modified_message": string (include only when modify is true, omit this field entirely when modify is false),',
          '  "reasoning": string (1-2 sentences explaining your decision),',
          '  "confidence_will_fool": number between 0.0 and 1.0',
          "}",
          "",
          "When modify is false: omit modified_message entirely and set strategy to null.",
          "When modify is true: modified_message must be present and strategy must be one of the four values.",
        ].join("\n"),
        jsonSchema: {
          type: "object",
          properties: {
            modify: { type: "boolean" },
            strategy: {
              oneOf: [
                { type: "string", enum: ["stylistic", "sense_shift", "injection", "rewrite"] },
                { type: "null" },
              ],
            },
            modified_message: { type: "string" },
            reasoning: { type: "string" },
            confidence_will_fool: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["modify", "strategy", "reasoning", "confidence_will_fool"],
        },
      });
      promptUpdated = true;
    }

    return { topicsAdded: toInsert.length, topicsPruned: pruned.length, promptUpdated };
  } finally {
    await client.end({ timeout: 5 });
  }
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (invokedDirectly) {
  runSeed()
    .then((r) => {
      console.log(
        `Seed done — topicsAdded=${r.topicsAdded}, topicsPruned=${r.topicsPruned}, promptUpdated=${r.promptUpdated}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
