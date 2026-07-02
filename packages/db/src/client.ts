import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://mlb:mlb@localhost:5432/mlb_stat_explorer";

export const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

export type Db = typeof db;
