import { db, type Db } from "../client.js";
import { playerBattingSeasonStats, players } from "../schema.js";

type FangraphsRawRow = Record<string, unknown>;

export type FangraphsBattingRow = {
  fangraphsId: number;
  name: string;
  season: number;
  team: string | null;
  games: number | null;
  plateAppearances: number | null;
  homeRuns: number | null;
  runs: number | null;
  runsBattedIn: number | null;
  stolenBases: number | null;
  walkRate: string | null;
  strikeoutRate: string | null;
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
  woba: string | null;
  wrcPlus: number | null;
  war: string | null;
  raw: FangraphsRawRow;
};

export type FangraphsBattingRepository = {
  upsertPlayer(input: { fangraphsId: number; name: string }): Promise<{ id: number }>;
  upsertBattingStat(input: FangraphsBattingRow & { playerId: number }): Promise<void>;
};

const REQUIRED_FIELDS = [
  "IDfg",
  "Name",
  "Season",
  "Team",
  "G",
  "PA",
  "HR",
  "R",
  "RBI",
  "SB",
  "BB%",
  "K%",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "wOBA",
  "wRC+",
  "WAR"
] as const;

export function validateFangraphsBattingRows(rows: FangraphsRawRow[]) {
  for (const field of REQUIRED_FIELDS) {
    if (rows.some((row) => !(field in row))) {
      throw new Error(`FanGraphs batting import is missing required field: ${field}`);
    }
  }
}

export function mapFangraphsBattingRow(row: FangraphsRawRow): FangraphsBattingRow {
  return {
    fangraphsId: parseRequiredInteger(row.IDfg, "IDfg"),
    name: parseRequiredString(row.Name, "Name"),
    season: parseRequiredInteger(row.Season, "Season"),
    team: parseNullableString(row.Team),
    games: parseNullableInteger(row.G, "G"),
    plateAppearances: parseNullableInteger(row.PA, "PA"),
    homeRuns: parseNullableInteger(row.HR, "HR"),
    runs: parseNullableInteger(row.R, "R"),
    runsBattedIn: parseNullableInteger(row.RBI, "RBI"),
    stolenBases: parseNullableInteger(row.SB, "SB"),
    walkRate: parseNullableDecimal(row["BB%"], "BB%"),
    strikeoutRate: parseNullableDecimal(row["K%"], "K%"),
    avg: parseNullableDecimal(row.AVG, "AVG"),
    obp: parseNullableDecimal(row.OBP, "OBP"),
    slg: parseNullableDecimal(row.SLG, "SLG"),
    ops: parseNullableDecimal(row.OPS, "OPS"),
    woba: parseNullableDecimal(row.wOBA, "wOBA"),
    wrcPlus: parseNullableInteger(row["wRC+"], "wRC+"),
    war: parseNullableDecimal(row.WAR, "WAR"),
    raw: row
  };
}

export function selectTotalRows(rows: FangraphsBattingRow[]) {
  const grouped = new Map<string, FangraphsBattingRow[]>();

  for (const row of rows) {
    const key = `${row.fangraphsId}:${row.season}`;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }

  return [...grouped.values()].map((group) => {
    if (group.length === 1) {
      return group[0]!;
    }

    const totalRows = group.filter((row) => isTotalTeam(row.team));

    if (totalRows.length === 1) {
      return totalRows[0]!;
    }

    throw new Error(
      `Ambiguous FanGraphs rows for player ${group[0]!.fangraphsId}, season ${group[0]!.season}`
    );
  });
}

export async function importFangraphsBattingRows(
  rawRows: FangraphsRawRow[],
  repository: FangraphsBattingRepository = createDrizzleFangraphsBattingRepository(db)
) {
  validateFangraphsBattingRows(rawRows);

  const mappedRows = rawRows.map(mapFangraphsBattingRow);
  const totalRows = selectTotalRows(mappedRows);

  for (const row of totalRows) {
    const player = await repository.upsertPlayer({
      fangraphsId: row.fangraphsId,
      name: row.name
    });

    await repository.upsertBattingStat({
      ...row,
      playerId: player.id
    });
  }

  return { imported: totalRows.length };
}

export function createDrizzleFangraphsBattingRepository(database: Db): FangraphsBattingRepository {
  return {
    async upsertPlayer(input) {
      const now = new Date();
      const [player] = await database
        .insert(players)
        .values({
          fangraphsId: input.fangraphsId,
          name: input.name,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: players.fangraphsId,
          set: {
            name: input.name,
            updatedAt: now
          }
        })
        .returning({ id: players.id });

      if (!player) {
        throw new Error(`Failed to upsert player ${input.fangraphsId}`);
      }

      return player;
    },
    async upsertBattingStat(input) {
      const now = new Date();
      await database
        .insert(playerBattingSeasonStats)
        .values({
          playerId: input.playerId,
          season: input.season,
          team: input.team,
          source: "fangraphs",
          games: input.games,
          plateAppearances: input.plateAppearances,
          homeRuns: input.homeRuns,
          runs: input.runs,
          runsBattedIn: input.runsBattedIn,
          stolenBases: input.stolenBases,
          walkRate: input.walkRate,
          strikeoutRate: input.strikeoutRate,
          avg: input.avg,
          obp: input.obp,
          slg: input.slg,
          ops: input.ops,
          woba: input.woba,
          wrcPlus: input.wrcPlus,
          war: input.war,
          raw: input.raw,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: [
            playerBattingSeasonStats.source,
            playerBattingSeasonStats.season,
            playerBattingSeasonStats.playerId
          ],
          set: {
            team: input.team,
            games: input.games,
            plateAppearances: input.plateAppearances,
            homeRuns: input.homeRuns,
            runs: input.runs,
            runsBattedIn: input.runsBattedIn,
            stolenBases: input.stolenBases,
            walkRate: input.walkRate,
            strikeoutRate: input.strikeoutRate,
            avg: input.avg,
            obp: input.obp,
            slg: input.slg,
            ops: input.ops,
            woba: input.woba,
            wrcPlus: input.wrcPlus,
            war: input.war,
            raw: input.raw,
            updatedAt: now
          }
        });
    }
  };
}

function isTotalTeam(team: string | null) {
  if (!team) {
    return false;
  }

  return team === "TOT" || team === "Total" || /^\d+ Teams$/.test(team);
}

function parseRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid required string field: ${field}`);
  }

  return value;
}

function parseRequiredInteger(value: unknown, field: string) {
  const parsed = parseNullableInteger(value, field);

  if (parsed === null) {
    throw new Error(`Invalid required integer field: ${field}`);
  }

  return parsed;
}

function parseNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function parseNullableInteger(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer field: ${field}`);
  }

  return parsed;
}

function parseNullableDecimal(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replace("%", "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid decimal field: ${field}`);
  }

  return normalized;
}
