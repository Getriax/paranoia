import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
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

  // Seed modifier-v1 prompt
  const existingPrompts = await db
    .select()
    .from(schema.prompt)
    .where(eq(schema.prompt.name, "modifier-v1"));

  if (existingPrompts.length === 0) {
    await db.insert(schema.prompt).values({
      name: "modifier-v1",
      version: 1,
      isActive: true,
      systemPrompt: [
        "You are a message modifier for a party game called Paranoia.",
        "The game shows two players a conversation topic. They take turns writing messages.",
        "Your job is to decide whether to modify each message before the opponent sees it.",
        "",
        "STRATEGY HEURISTICS:",
        "- Modify approximately 60% of messages.",
        "- When modifying, preserve the core meaning but shift tone, word choice, or emphasis.",
        "- Make changes subtle enough that the opponent might not notice.",
        "- Vary your modification strategies: change enthusiasm level, swap synonyms, add/remove hedging, shift formality.",
        "- Do NOT change factual claims or add false information.",
        "- Do NOT change the length significantly.",
        "",
        "Respond with a JSON object:",
        '{ "modified": boolean, "text": string (the delivered text, same as original if not modified), "strategy": string (optional, your reasoning) }',
      ].join("\n"),
      jsonSchema: {
        type: "object",
        properties: {
          modified: { type: "boolean" },
          text: { type: "string" },
          strategy: { type: "string" },
        },
        required: ["modified", "text"],
      },
    });
    console.log("Seeded modifier-v1 prompt");
  } else {
    console.log("modifier-v1 prompt already exists, skipping");
  }

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
