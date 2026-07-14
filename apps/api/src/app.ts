import { and, asc, desc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import Fastify from "fastify";
import {
  db,
  fangraphsBattingAdvancedStats,
  mlbBattingSeasonStats,
  players
} from "@mlb-stat-explorer/db";

type SortField = "playerName" | "homeRuns";
type SortOrder = "asc" | "desc";

type BattingStatsQuery = {
  season?: string;
  playerName?: string;
  team?: string;
  limit?: string;
  sort?: string;
  order?: string;
};

const allowedSortFields = {
  playerName: players.name,
  homeRuns: mlbBattingSeasonStats.homeRuns
};

export function buildApp(database: typeof db = db) {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return { ok: true };
  });

  app.get<{ Querystring: BattingStatsQuery }>("/batting-stats", async (request, reply) => {
    const parsed = parseBattingStatsQuery(request.query);

    if (!parsed.ok) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { season, playerName, team, limit, sort, order } = parsed.value;
    const filters: SQL[] = [
      eq(mlbBattingSeasonStats.season, season),
      eq(mlbBattingSeasonStats.splitType, "total")
    ];

    if (playerName) {
      filters.push(ilike(players.name, `%${playerName}%`));
    }

    if (team) {
      filters.push(eq(mlbBattingSeasonStats.team, team));
    }

    const sortColumn = allowedSortFields[sort];
    const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await database
      .select({
        playerId: players.id,
        mlbamId: players.mlbamId,
        playerName: players.name,
        season: mlbBattingSeasonStats.season,
        mlbImportedAt: mlbBattingSeasonStats.importedAt,
        games: mlbBattingSeasonStats.games,
        plateAppearances: mlbBattingSeasonStats.plateAppearances,
        homeRuns: mlbBattingSeasonStats.homeRuns,
        runs: mlbBattingSeasonStats.runs,
        runsBattedIn: mlbBattingSeasonStats.runsBattedIn,
        stolenBases: mlbBattingSeasonStats.stolenBases,
        avg: mlbBattingSeasonStats.avg,
        obp: mlbBattingSeasonStats.obp,
        slg: mlbBattingSeasonStats.slg,
        ops: mlbBattingSeasonStats.ops,
        fangraphsImportedAt: fangraphsBattingAdvancedStats.importedAt,
        woba: fangraphsBattingAdvancedStats.woba,
        wrcPlus: fangraphsBattingAdvancedStats.wrcPlus,
        war: fangraphsBattingAdvancedStats.war
      })
      .from(mlbBattingSeasonStats)
      .innerJoin(players, eq(mlbBattingSeasonStats.playerId, players.id))
      .leftJoin(
        fangraphsBattingAdvancedStats,
        and(
          eq(fangraphsBattingAdvancedStats.playerId, mlbBattingSeasonStats.playerId),
          eq(fangraphsBattingAdvancedStats.season, mlbBattingSeasonStats.season)
        )
      )
      .where(and(...filters))
      .orderBy(orderBy, asc(players.name))
      .limit(limit);

    if (rows.length === 0) {
      return [];
    }

    const playerIds = rows.map((row) => row.playerId);
    const teamSplits = await database
      .select({
        playerId: mlbBattingSeasonStats.playerId,
        team: mlbBattingSeasonStats.team,
        importedAt: mlbBattingSeasonStats.importedAt,
        games: mlbBattingSeasonStats.games,
        plateAppearances: mlbBattingSeasonStats.plateAppearances,
        homeRuns: mlbBattingSeasonStats.homeRuns,
        runs: mlbBattingSeasonStats.runs,
        runsBattedIn: mlbBattingSeasonStats.runsBattedIn,
        stolenBases: mlbBattingSeasonStats.stolenBases,
        avg: mlbBattingSeasonStats.avg,
        obp: mlbBattingSeasonStats.obp,
        slg: mlbBattingSeasonStats.slg,
        ops: mlbBattingSeasonStats.ops
      })
      .from(mlbBattingSeasonStats)
      .where(
        and(
          eq(mlbBattingSeasonStats.season, season),
          eq(mlbBattingSeasonStats.splitType, "team"),
          inArray(mlbBattingSeasonStats.playerId, playerIds)
        )
      );

    return rows.map((row) => ({
      playerId: row.playerId,
      mlbamId: row.mlbamId,
      playerName: row.playerName,
      season: row.season,
      standard: {
        source: "mlb" as const,
        importedAt: row.mlbImportedAt.toISOString(),
        stats: serializeStandardStats(row)
      },
      advanced: row.fangraphsImportedAt
        ? {
            source: "fangraphs" as const,
            available: true as const,
            importedAt: row.fangraphsImportedAt.toISOString(),
            stats: {
              woba: toNumber(row.woba),
              wrcPlus: row.wrcPlus,
              war: toNumber(row.war)
            }
          }
        : {
            source: "fangraphs" as const,
            available: false as const,
            importedAt: null,
            stats: null
          },
      teamSplits: teamSplits
        .filter((split) => split.playerId === row.playerId)
        .map((split) => ({
          team: split.team,
          standard: {
            source: "mlb" as const,
            importedAt: split.importedAt.toISOString(),
            stats: serializeStandardStats(split)
          }
        }))
    }));
  });

  app.get("/seasons", async () => {
    const rows = await database
      .selectDistinct({
        season: mlbBattingSeasonStats.season
      })
      .from(mlbBattingSeasonStats)
      .where(eq(mlbBattingSeasonStats.splitType, "total"))
      .orderBy(desc(mlbBattingSeasonStats.season));

    return rows.map((row) => row.season);
  });

  return app;
}

function parseBattingStatsQuery(query: BattingStatsQuery) {
  const season = Number(query.season);

  if (!Number.isInteger(season)) {
    return { ok: false as const, error: "Missing or invalid required query param: season" };
  }

  return {
    ok: true as const,
    value: {
      season,
      playerName: normalizeOptionalString(query.playerName),
      team: normalizeOptionalString(query.team),
      limit: parseLimit(query.limit),
      sort: parseSort(query.sort),
      order: parseOrder(query.order)
    }
  };
}

function parseLimit(value: string | undefined) {
  if (value === undefined) {
    return 25;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 25;
  }

  return Math.min(parsed, 100);
}

function parseSort(value: string | undefined): SortField {
  if (value === "homeRuns") {
    return value;
  }

  return "playerName";
}

function parseOrder(value: string | undefined): SortOrder {
  return value === "desc" ? "desc" : "asc";
}

function normalizeOptionalString(value: string | undefined) {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

function toNumber(value: string | number | null) {
  if (value === null || typeof value === "number") {
    return value;
  }

  return Number(value);
}

function serializeStandardStats(row: {
  games: number | null;
  plateAppearances: number | null;
  homeRuns: number | null;
  runs: number | null;
  runsBattedIn: number | null;
  stolenBases: number | null;
  avg: string | number | null;
  obp: string | number | null;
  slg: string | number | null;
  ops: string | number | null;
}) {
  return {
    games: row.games,
    plateAppearances: row.plateAppearances,
    homeRuns: row.homeRuns,
    runs: row.runs,
    runsBattedIn: row.runsBattedIn,
    stolenBases: row.stolenBases,
    avg: toNumber(row.avg),
    obp: toNumber(row.obp),
    slg: toNumber(row.slg),
    ops: toNumber(row.ops)
  };
}
