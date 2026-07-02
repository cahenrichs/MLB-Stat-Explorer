import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import Fastify from "fastify";
import { db, playerBattingSeasonStats, players } from "@mlb-stat-explorer/db";

type StatSource = "fangraphs";
type SortField = "playerName" | "homeRuns" | "war" | "wrcPlus";
type SortOrder = "asc" | "desc";

type BattingStatsQuery = {
  season?: string;
  source?: string;
  playerName?: string;
  team?: string;
  limit?: string;
  sort?: string;
  order?: string;
};

type SeasonsQuery = {
  source?: string;
};

const allowedSortFields = {
  playerName: players.name,
  homeRuns: playerBattingSeasonStats.homeRuns,
  war: playerBattingSeasonStats.war,
  wrcPlus: playerBattingSeasonStats.wrcPlus
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

    const { season, source, playerName, team, limit, sort, order } = parsed.value;
    const filters: SQL[] = [
      eq(playerBattingSeasonStats.season, season),
      eq(playerBattingSeasonStats.source, source)
    ];

    if (playerName) {
      filters.push(ilike(players.name, `%${playerName}%`));
    }

    if (team) {
      filters.push(eq(playerBattingSeasonStats.team, team));
    }

    const sortColumn = allowedSortFields[sort];
    const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await database
      .select({
        playerId: players.id,
        fangraphsId: players.fangraphsId,
        playerName: players.name,
        season: playerBattingSeasonStats.season,
        team: playerBattingSeasonStats.team,
        source: playerBattingSeasonStats.source,
        games: playerBattingSeasonStats.games,
        plateAppearances: playerBattingSeasonStats.plateAppearances,
        homeRuns: playerBattingSeasonStats.homeRuns,
        runs: playerBattingSeasonStats.runs,
        runsBattedIn: playerBattingSeasonStats.runsBattedIn,
        stolenBases: playerBattingSeasonStats.stolenBases,
        walkRate: playerBattingSeasonStats.walkRate,
        strikeoutRate: playerBattingSeasonStats.strikeoutRate,
        avg: playerBattingSeasonStats.avg,
        obp: playerBattingSeasonStats.obp,
        slg: playerBattingSeasonStats.slg,
        ops: playerBattingSeasonStats.ops,
        woba: playerBattingSeasonStats.woba,
        wrcPlus: playerBattingSeasonStats.wrcPlus,
        war: playerBattingSeasonStats.war
      })
      .from(playerBattingSeasonStats)
      .innerJoin(players, eq(playerBattingSeasonStats.playerId, players.id))
      .where(and(...filters))
      .orderBy(orderBy, asc(players.name))
      .limit(limit);

    return rows.map(convertNumericStats);
  });

  app.get<{ Querystring: SeasonsQuery }>("/seasons", async (request, reply) => {
    const parsed = parseSource(request.query.source);

    if (!parsed.ok) {
      return reply.code(400).send({ error: parsed.error });
    }

    const rows = await database
      .selectDistinct({
        season: playerBattingSeasonStats.season
      })
      .from(playerBattingSeasonStats)
      .where(eq(playerBattingSeasonStats.source, parsed.value))
      .orderBy(desc(playerBattingSeasonStats.season));

    return rows.map((row) => row.season);
  });

  return app;
}

function parseBattingStatsQuery(query: BattingStatsQuery) {
  const season = Number(query.season);

  if (!Number.isInteger(season)) {
    return { ok: false as const, error: "Missing or invalid required query param: season" };
  }

  const source = parseSource(query.source);

  if (!source.ok) {
    return source;
  }

  return {
    ok: true as const,
    value: {
      season,
      source: source.value,
      playerName: normalizeOptionalString(query.playerName),
      team: normalizeOptionalString(query.team),
      limit: parseLimit(query.limit),
      sort: parseSort(query.sort),
      order: parseOrder(query.order)
    }
  };
}

function parseSource(source: string | undefined) {
  if (source === undefined || source === "fangraphs") {
    return { ok: true as const, value: "fangraphs" as StatSource };
  }

  return { ok: false as const, error: "Invalid source" };
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
  if (value === "homeRuns" || value === "war" || value === "wrcPlus") {
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
    walkRate: toNumber(row.walkRate as string | number | null),
    strikeoutRate: toNumber(row.strikeoutRate as string | number | null),
    avg: toNumber(row.avg as string | number | null),
    obp: toNumber(row.obp as string | number | null),
    slg: toNumber(row.slg as string | number | null),
    ops: toNumber(row.ops as string | number | null),
    woba: toNumber(row.woba as string | number | null),
    war: toNumber(row.war as string | number | null)
  };
}
