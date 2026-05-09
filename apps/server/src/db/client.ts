import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const client = postgres(process.env.POSTGRES_URL!, {
  max: Number(process.env.PGPOOL_MAX ?? 10),
  prepare: false,
  connection: { timezone: "UTC" },
});

export const db = drizzle(client, { schema });
