import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sql } from "../client.js";
import { importFangraphsBattingRows } from "../import/fangraphsBatting.js";

function parseSeason() {
  const seasonIndex = process.argv.indexOf("--season");

  if (seasonIndex === -1) {
    throw new Error("Missing required argument: --season");
  }

  const season = Number(process.argv[seasonIndex + 1]);

  if (!Number.isInteger(season)) {
    throw new Error("Invalid --season value");
  }

  return season;
}

const season = parseSeason();
const filePath = resolve(process.cwd(), "../../ingestion/data", `fangraphs-batting-${season}.json`);

try {
  const file = await readFile(filePath, "utf-8");
  const rows = JSON.parse(file) as Record<string, unknown>[];
  const result = await importFangraphsBattingRows(rows);

  console.log(`Imported ${result.imported} FanGraphs batting rows for ${season}`);
} finally {
  await sql.end();
}
