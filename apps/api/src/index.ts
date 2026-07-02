import { sql } from "@mlb-stat-explorer/db";
import { buildApp } from "./app.js";

const app = buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "localhost";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const close = async () => {
  await app.close();
  await sql.end();
};

process.on("SIGINT", () => {
  void close().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void close().then(() => process.exit(0));
});
