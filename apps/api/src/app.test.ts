import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";

test("GET /batting-stats requires season", async () => {
  const app = buildApp(createMockDb());

  const response = await app.inject({
    method: "GET",
    url: "/batting-stats"
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    error: "Missing or invalid required query param: season"
  });
});

test("GET /batting-stats serializes MLB and FanGraphs provenance", async () => {
  const app = buildApp(
    createMockDb([
      {
        playerId: 1,
        mlbamId: 592450,
        playerName: "Aaron Judge",
        season: 2024,
        mlbImportedAt: new Date("2026-07-14T12:00:00.000Z"),
        games: 158,
        plateAppearances: 704,
        homeRuns: 58,
        runs: 122,
        runsBattedIn: 144,
        stolenBases: 10,
        avg: ".322",
        obp: ".458",
        slg: ".701",
        ops: "1.159",
        fangraphsImportedAt: new Date("2026-07-14T12:05:00.000Z"),
        woba: ".476",
        wrcPlus: 218,
        war: "11.2"
      }
    ])
  );

  const response = await app.inject({
    method: "GET",
    url: "/batting-stats?season=2024&playerName=judge"
  });

  assert.equal(response.statusCode, 200);

  assert.deepEqual(response.json(), [
    {
      playerId: 1,
      mlbamId: 592450,
      playerName: "Aaron Judge",
      season: 2024,
      standard: {
        source: "mlb",
        importedAt: "2026-07-14T12:00:00.000Z",
        stats: {
          games: 158,
          plateAppearances: 704,
          homeRuns: 58,
          runs: 122,
          runsBattedIn: 144,
          stolenBases: 10,
          avg: 0.322,
          obp: 0.458,
          slg: 0.701,
          ops: 1.159
        }
      },
      advanced: {
        source: "fangraphs",
        available: true,
        importedAt: "2026-07-14T12:05:00.000Z",
        stats: { woba: 0.476, wrcPlus: 218, war: 11.2 }
      },
      teamSplits: []
    }
  ]);
});

test("GET /batting-stats marks advanced metrics unavailable when no FanGraphs import exists", async () => {
  const app = buildApp(
    createMockDb([
      {
        playerId: 1,
        mlbamId: 592450,
        playerName: "Aaron Judge",
        season: 2024,
        mlbImportedAt: new Date("2026-07-14T12:00:00.000Z"),
        games: 158,
        plateAppearances: 704,
        homeRuns: 58,
        runs: 122,
        runsBattedIn: 144,
        stolenBases: 10,
        avg: ".322",
        obp: ".458",
        slg: ".701",
        ops: "1.159",
        fangraphsImportedAt: null,
        woba: null,
        wrcPlus: null,
        war: null
      }
    ])
  );

  const response = await app.inject({
    method: "GET",
    url: "/batting-stats?season=2024"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json()[0].advanced, {
    source: "fangraphs",
    available: false,
    importedAt: null,
    stats: null
  });
});

test("GET /batting-stats nests MLB team splits for traded players", async () => {
  const app = buildApp(
    createMockDb(
      [
        {
          playerId: 1,
          mlbamId: 621043,
          playerName: "Tommy Edman",
          season: 2024,
          mlbImportedAt: new Date("2026-07-14T12:00:00.000Z"),
          games: 137,
          plateAppearances: 601,
          homeRuns: 13,
          runs: 64,
          runsBattedIn: 49,
          stolenBases: 21,
          avg: ".237",
          obp: ".294",
          slg: ".365",
          ops: ".659",
          fangraphsImportedAt: null,
          woba: null,
          wrcPlus: null,
          war: null
        }
      ],
      [
        {
          playerId: 1,
          team: "CHW",
          importedAt: new Date("2026-07-14T12:00:00.000Z"),
          games: 89,
          plateAppearances: 391,
          homeRuns: 8,
          runs: 41,
          runsBattedIn: 31,
          stolenBases: 14,
          avg: ".240",
          obp: ".300",
          slg: ".370",
          ops: ".670"
        },
        {
          playerId: 1,
          team: "LAD",
          importedAt: new Date("2026-07-14T12:00:00.000Z"),
          games: 48,
          plateAppearances: 210,
          homeRuns: 5,
          runs: 23,
          runsBattedIn: 18,
          stolenBases: 7,
          avg: ".232",
          obp: ".282",
          slg: ".355",
          ops: ".637"
        }
      ]
    )
  );

  const response = await app.inject({
    method: "GET",
    url: "/batting-stats?season=2024"
  });

  assert.equal(response.statusCode, 200);
  const [row] = response.json();
  assert.equal(row.teamSplits.length, 2);
  assert.deepEqual(row.teamSplits.map((split: { team: string }) => split.team), ["CHW", "LAD"]);
  assert.equal("advanced" in row.teamSplits[0], false);
});

test("GET /seasons returns distinct seasons", async () => {
  const app = buildApp(createMockDb([], [], [{ season: 2024 }, { season: 2023 }]));

  const response = await app.inject({
    method: "GET",
    url: "/seasons"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), [2024, 2023]);
});

function createMockDb(
  battingRows: unknown[] = [],
  teamSplitRows: unknown[] = [],
  seasonRows: unknown[] = []
) {
  let selectCalls = 0;
  const battingQuery = {
    from() {
      return battingQuery;
    },
    innerJoin() {
      return battingQuery;
    },
    leftJoin() {
      return battingQuery;
    },
    where() {
      return battingQuery;
    },
    orderBy() {
      return battingQuery;
    },
    limit() {
      return Promise.resolve(battingRows);
    }
  };

  const teamSplitQuery = {
    from() {
      return teamSplitQuery;
    },
    where() {
      return Promise.resolve(teamSplitRows);
    }
  };

  const seasonQuery = {
    from() {
      return seasonQuery;
    },
    where() {
      return seasonQuery;
    },
    orderBy() {
      return Promise.resolve(seasonRows);
    }
  };

  return {
    select() {
      selectCalls += 1;
      return selectCalls === 1 ? battingQuery : teamSplitQuery;
    },
    selectDistinct() {
      return seasonQuery;
    }
  } as never;
}
