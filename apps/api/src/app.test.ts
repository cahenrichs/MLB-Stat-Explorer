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

test("GET /batting-stats returns rows without raw and numeric decimals as numbers", async () => {
  const app = buildApp(
    createMockDb([
      {
        playerId: 1,
        fangraphsId: 15640,
        playerName: "Aaron Judge",
        season: 2024,
        team: "NYY",
        source: "mlb",
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
        sourceSeason: 2024
      }
    ])
  );

  const response = await app.inject({
    method: "GET",
    url: "/batting-stats?season=2024&playerName=judge"
  });

  assert.equal(response.statusCode, 200);

  const [row] = response.json();

  assert.equal(row.playerName, "Aaron Judge");
    assert.equal(row.avg, 0.322);
  assert.equal("raw" in row, false);
});

test("GET /seasons returns distinct seasons", async () => {
  const app = buildApp(createMockDb([], [{ season: 2024 }, { season: 2023 }]));

  const response = await app.inject({
    method: "GET",
    url: "/seasons"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), [2024, 2023]);
});

function createMockDb(battingRows: unknown[] = [], seasonRows: unknown[] = []) {
  const battingQuery = {
    from() {
      return battingQuery;
    },
    innerJoin() {
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
      return battingQuery;
    },
    selectDistinct() {
      return seasonQuery;
    }
  } as never;
}
