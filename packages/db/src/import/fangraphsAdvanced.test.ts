import assert from "node:assert/strict";
import test from "node:test";
import type { BattingRepository, UpsertFangraphsAdvancedStatInput } from "../battingRepository.js";
import { importFangraphsAdvancedCsv } from "./fangraphsAdvanced.js";

test("imports documented aliases using existing MLBAM players", async () => {
  const repository = createMemoryRepository([650333]);
  const result = await importFangraphsAdvancedCsv({
    season: 2024,
    repository,
    csv: "MLBAM_ID,Year,wOBA,wRC Plus,fWAR\n650333,2024,.346,125,4.1\n"
  });

  assert.deepEqual(result, { players: 1 });
  assert.deepEqual(repository.stats.get("1:2024"), {
    playerId: 1,
    season: 2024,
    sourceSeason: 2024,
    woba: ".346",
    wrcPlus: 125,
    war: "4.1",
    raw: { MLBAM_ID: "650333", Year: "2024", wOBA: ".346", "wRC Plus": "125", fWAR: "4.1" },
    importedAt: repository.stats.get("1:2024")?.importedAt
  });
});

test("reports invalid, duplicate, and unknown IDs without changing records", async () => {
  const repository = createMemoryRepository([650333]);
  await repository.upsertFangraphsAdvancedStat(stat());
  const before = new Map(repository.stats);

  await assert.rejects(
    importFangraphsAdvancedCsv({
      season: 2024,
      repository,
      csv: [
        "MLBAM ID,Season,wOBA,wRC+,WAR",
        "not-an-id,2024,.346,125,4.1",
        "650333,2024,.346,125,4.1",
        "650333,2024,.346,125,4.1",
        "999999,2024,.346,125,4.1"
      ].join("\n")
    }),
    /Row 2: MLBAM ID is invalid[\s\S]*Row 4: duplicate MLBAM ID 650333[\s\S]*Row 5: MLBAM ID 999999 is not known/
  );

  assert.deepEqual(repository.stats, before);
});

test("requires season-total fields and a matching requested season", async () => {
  await assert.rejects(
    importFangraphsAdvancedCsv({
      season: 2024,
      repository: createMemoryRepository([650333]),
      csv: "MLBAM ID,Season,wOBA,wRC+\n650333,2023,.346,125\n"
    }),
    /missing required headers: war/
  );

  await assert.rejects(
    importFangraphsAdvancedCsv({
      season: 2024,
      repository: createMemoryRepository([650333]),
      csv: "MLBAM ID,Season,wOBA,wRC+,WAR\n650333,2023,.346,125,4.1\n"
    }),
    /Row 2: season must be 2024/
  );
});

function stat(): UpsertFangraphsAdvancedStatInput {
  return {
    playerId: 1,
    season: 2024,
    sourceSeason: 2024,
    woba: ".320",
    wrcPlus: 110,
    war: "2.0",
    raw: {},
    importedAt: new Date("2026-07-14T12:00:00.000Z")
  };
}

function createMemoryRepository(mlbamIds: number[]) {
  const players = new Map(mlbamIds.map((mlbamId, index) => [mlbamId, { id: index + 1 }]));
  const stats = new Map<string, UpsertFangraphsAdvancedStatInput>();
  const repository: BattingRepository & { stats: typeof stats } = {
    stats,
    async transaction(callback) {
      const staged = createMemoryRepository([]);
      players.forEach((value, key) => staged.players.set(key, value));
      stats.forEach((value, key) => staged.stats.set(key, value));
      const result = await callback(staged);
      stats.clear();
      staged.stats.forEach((value, key) => stats.set(key, value));
      return result;
    },
    async findPlayerByMlbamId(mlbamId) {
      return players.get(mlbamId) ?? null;
    },
    async upsertPlayer() {
      throw new Error("FanGraphs imports must not create players");
    },
    async upsertMlbBattingStat() {
      throw new Error("FanGraphs imports must not write MLB stats");
    },
    async upsertFangraphsAdvancedStat(input) {
      stats.set(`${input.playerId}:${input.season}`, input);
    }
  };
  return Object.assign(repository, { players });
}
