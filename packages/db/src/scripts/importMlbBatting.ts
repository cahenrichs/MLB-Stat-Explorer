import { createBattingRepository } from "../battingRepository.js";
import { sql } from "../client.js";
import { importMlbQualifiedBattingSeason } from "../import/mlbBatting.js";

const season = parseSeason(process.argv.slice(2));
try {
  const result = await importMlbQualifiedBattingSeason({
    season,
    repository: createBattingRepository()
  });

  console.log(
    `Imported ${result.players} qualified hitters and ${result.stats} MLB batting records for ${season}.`
  );
} finally {
  await sql.end();
}

function parseSeason(args: string[]): number {
  const index = args.indexOf("--season");
  const value = index === -1 ? undefined : args[index + 1];
  if (!value || !/^\d{4}$/.test(value)) {
    throw new Error("Usage: import:mlb-batting --season YYYY");
  }
  return Number(value);
}
