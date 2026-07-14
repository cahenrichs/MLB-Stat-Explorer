import { readFile } from "node:fs/promises";
import { createBattingRepository } from "../battingRepository.js";
import { sql } from "../client.js";
import { importFangraphsAdvancedCsv } from "../import/fangraphsAdvanced.js";

const { season, csvPath } = parseArguments(process.argv.slice(2));
try {
  const csv = await readFile(csvPath, "utf8");
  const result = await importFangraphsAdvancedCsv({
    season,
    csv,
    repository: createBattingRepository()
  });
  console.log(`Imported ${result.players} FanGraphs advanced batting records for ${season}.`);
} finally {
  await sql.end();
}

function parseArguments(args: string[]): { season: number; csvPath: string } {
  const seasonIndex = args.indexOf("--season");
  const csvIndex = args.indexOf("--csv");
  const season = seasonIndex === -1 ? undefined : args[seasonIndex + 1];
  const csvPath = csvIndex === -1 ? undefined : args[csvIndex + 1];
  if (!season || !/^\d{4}$/.test(season) || !csvPath) {
    throw new Error("Usage: import:fangraphs-advanced --season YYYY --csv path/to/file.csv");
  }
  return { season: Number(season), csvPath };
}
