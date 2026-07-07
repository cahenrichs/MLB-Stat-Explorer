import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema.js";

const packageDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(packageDir, "../../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Add it to the root .env file.");
}

export const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

export type Db = typeof db;
