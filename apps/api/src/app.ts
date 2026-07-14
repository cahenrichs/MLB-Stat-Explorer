import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import Fastify from "fastify";
import { db, mlbBattingSeasonStats, players } from "@mlb-stat-explorer/db";

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
        fangraphsId: players.fangraphsId,
        playerName: players.name,
        season: mlbBattingSeasonStats.season,
        team: mlbBattingSeasonStats.team,
        source: mlbBattingSeasonStats.source,
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
      .innerJoin(players, eq(mlbBattingSeasonStats.playerId, players.id))
      .where(and(...filters))
      .orderBy(orderBy, asc(players.name))
      .limit(limit);

    return rows.map(convertNumericStats);
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

function convertNumericStats<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    avg: toNumber(row.avg as string | number | null),
    obp: toNumber(row.obp as string | number | null),
    slg: toNumber(row.slg as string | number | null),
    ops: toNumber(row.ops as string | number | null)
  };
}
