import type { BattingRepository, UpsertMlbBattingStatInput } from "../battingRepository.js";
import { createBattingRepository } from "../battingRepository.js";

const MLB_STATS_API = "https://statsapi.mlb.com/api/v1";

type Fetch = (input: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

type ImportOptions = {
  season: number;
  repository?: BattingRepository;
  fetch?: Fetch;
  apiBaseUrl?: string;
};

type PlayerImport = {
  mlbamId: number;
  name: string;
  stats: Omit<UpsertMlbBattingStatInput, "playerId">[];
};

export async function importMlbQualifiedBattingSeason({
  season,
  repository = createBattingRepository(),
  fetch = globalThis.fetch,
  apiBaseUrl = MLB_STATS_API
}: ImportOptions): Promise<{ players: number; stats: number }> {
  if (!Number.isInteger(season) || season < 2024) {
    throw new Error("Season must be an integer from 2024 onward");
  }

  const importedAt = new Date();
  const leaderboard = await fetchJson(
    fetch,
    `${apiBaseUrl}/stats?${new URLSearchParams({
      stats: "season",
      group: "hitting",
      playerPool: "QUALIFIED",
      season: String(season),
      gameType: "R",
      sportIds: "1",
      limit: "10000",
      hydrate: "person,team"
    })}`
  );
  const qualifiedPlayers = parseQualifiedPlayers(leaderboard, season);
  const imports = await Promise.all(
    qualifiedPlayers.map((player) => fetchPlayerImport(fetch, apiBaseUrl, season, player, importedAt))
  );

  await repository.transaction(async (transaction) => {
    for (const playerImport of imports) {
      const player = await transaction.upsertPlayer({
        mlbamId: playerImport.mlbamId,
        name: playerImport.name
      });

      for (const stat of playerImport.stats) {
        await transaction.upsertMlbBattingStat({ ...stat, playerId: player.id });
      }
    }
  });

  return {
    players: imports.length,
    stats: imports.reduce((count, player) => count + player.stats.length, 0)
  };
}

async function fetchPlayerImport(
  fetch: Fetch,
  apiBaseUrl: string,
  season: number,
  player: { id: number; name: string; total: unknown },
  importedAt: Date
): Promise<PlayerImport> {
  const response = await fetchJson(
    fetch,
    `${apiBaseUrl}/people/${player.id}/stats?${new URLSearchParams({
      stats: "season",
      group: "hitting",
      season: String(season),
      gameType: "R"
    })}`
  );
  const stats = getArray(getRecord(response), "stats");
  const splits = getArray(getRecord(stats[0]), "splits");
  const teamSplits = splits.filter((split) => getRecord(split).team);

  if (teamSplits.length === 0) {
    throw new Error(`Incomplete regular-season splits for MLBAM player ${player.id}`);
  }

  return {
    mlbamId: player.id,
    name: player.name,
    stats: [
      parseStat(player.total, season, "total", "", importedAt),
      ...teamSplits.map((split) => {
        const team = requireString(getRecord(split).team, "name");
        return parseStat(split, season, "team", team, importedAt);
      })
    ]
  };
}

function parseQualifiedPlayers(
  response: unknown,
  season: number
): { id: number; name: string; total: unknown }[] {
  const stats = getArray(response, "stats");
  const splits = getArray(getRecord(stats[0]), "splits");

  if (splits.length === 0) {
    throw new Error(`MLB returned no qualified hitters for ${season}`);
  }

  return splits.map((split) => {
    const player = getRecord(getRecord(split).player);
    return {
      id: requireInteger(player, "id"),
      name: requireString(player, "fullName"),
      total: split
    };
  });
}

function parseStat(
  split: unknown,
  season: number,
  splitType: "total" | "team",
  team: string,
  importedAt: Date
): Omit<UpsertMlbBattingStatInput, "playerId"> {
  const record = getRecord(split);
  const stat = getRecord(record.stat);
  const integer = (key: string) => requireInteger(stat, key);
  const decimal = (key: string) => requireDecimal(stat, key);

  return {
    season,
    sourceSeason: season,
    splitType,
    team,
    games: integer("gamesPlayed"),
    plateAppearances: integer("plateAppearances"),
    atBats: integer("atBats"),
    runs: integer("runs"),
    hits: integer("hits"),
    doubles: integer("doubles"),
    triples: integer("triples"),
    homeRuns: integer("homeRuns"),
    runsBattedIn: integer("rbi"),
    baseOnBalls: integer("baseOnBalls"),
    strikeOuts: integer("strikeOuts"),
    stolenBases: integer("stolenBases"),
    caughtStealing: integer("caughtStealing"),
    hitByPitch: integer("hitByPitch"),
    sacBunts: integer("sacBunts"),
    sacFlies: integer("sacFlies"),
    totalBases: integer("totalBases"),
    groundIntoDoublePlay: integer("groundIntoDoublePlay"),
    avg: decimal("avg"),
    obp: decimal("obp"),
    slg: decimal("slg"),
    ops: decimal("ops"),
    raw: record,
    importedAt
  };
}

async function fetchJson(fetch: Fetch, url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MLB Stats API request failed with ${response.status}`);
  }
  return response.json();
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Malformed MLB Stats API response");
  }
  return value as Record<string, unknown>;
}

function getArray(value: unknown, key: string): unknown[] {
  const result = getRecord(value)[key];
  if (!Array.isArray(result)) {
    throw new Error(`Malformed MLB Stats API response: ${key} is missing`);
  }
  return result;
}

function requireInteger(value: Record<string, unknown>, key: string): number {
  const result = value[key];
  if (typeof result !== "number" || !Number.isInteger(result) || result < 0) {
    throw new Error(`Malformed MLB Stats API response: ${key} is invalid`);
  }
  return result;
}

function requireString(value: unknown, key: string): string {
  const result = getRecord(value)[key];
  if (typeof result !== "string" || result.length === 0) {
    throw new Error(`Malformed MLB Stats API response: ${key} is invalid`);
  }
  return result;
}

function requireDecimal(value: Record<string, unknown>, key: string): string {
  const result = value[key];
  if (typeof result !== "string" || !/^(?:\d+|\d*\.\d+)$/.test(result)) {
    throw new Error(`Malformed MLB Stats API response: ${key} is invalid`);
  }
  return result;
}
