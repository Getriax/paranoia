import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema.js";
import topicsData from "../../seeds/topics.json" with { type: "json" };

const client = postgres(process.env.POSTGRES_URL!, {
  max: 1,
  prepare: false,
  connection: { timezone: "UTC" },
});

const db = drizzle(client, { schema });

async function seed() {
  // Seed topics
  const existingTopics = await db.select().from(schema.topic);
  if (existingTopics.length === 0) {
    await db.insert(schema.topic).values(
      topicsData.map((t) => ({
        text: t.text,
        category: t.category as (typeof schema.topicCategoryEnum.enumValues)[number],
        difficulty: t.difficulty as (typeof schema.topicDifficultyEnum.enumValues)[number],
      })),
    );
    console.log(`Seeded ${topicsData.length} topics`);
  } else {
    console.log(`Topics already exist (${existingTopics.length}), skipping`);
  }

  // Seed modifier-v1 prompt (version 2 — updated schema matching modifierResponseSchema)
  const existingV2 = await db
    .select()
    .from(schema.prompt)
    .where(
      and(
        eq(schema.prompt.name, "modifier-v1"),
        eq(schema.prompt.version, 2),
      ),
    );

  if (existingV2.length === 0) {
    // Deactivate the v1 row specifically (only if it still exists and is active)
    await db
      .update(schema.prompt)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.prompt.name, "modifier-v1"),
          eq(schema.prompt.version, 1),
        ),
      );

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
        "  \"modify\": boolean,",
        "  \"strategy\": \"stylistic\" | \"sense_shift\" | \"injection\" | \"rewrite\" | null,",
        "  \"modified_message\": string (include only when modify is true, omit this field entirely when modify is false),",
        "  \"reasoning\": string (1-2 sentences explaining your decision),",
        "  \"confidence_will_fool\": number between 0.0 and 1.0",
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
    console.log("Seeded modifier-v1 prompt (version 2)");
  } else {
    console.log("modifier-v1 v2 prompt already exists, skipping");
  }

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
