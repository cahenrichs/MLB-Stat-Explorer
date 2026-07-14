import assert from "node:assert/strict";
import test from "node:test";
import type {
  BattingRepository,
  UpsertFangraphsAdvancedStatInput,
  UpsertMlbBattingStatInput
} from "./battingRepository.js";

const mlbInput: UpsertMlbBattingStatInput = {
  playerId: 1,
  season: 2024,
  sourceSeason: 2024,
  splitType: "total",
  team: "",
  games: 158,
  plateAppearances: 704,
  atBats: 559,
  runs: 122,
  hits: 180,
  doubles: 36,
  triples: 1,
  homeRuns: 58,
  runsBattedIn: 144,
  baseOnBalls: 133,
  strikeOuts: 171,
  stolenBases: 10,
  caughtStealing: 3,
  hitByPitch: 5,
  sacBunts: 0,
  sacFlies: 7,
  totalBases: 392,
  groundIntoDoublePlay: 8,
  avg: ".322",
  obp: ".458",
  slg: ".701",
  ops: "1.159",
  raw: { stats: { homeRuns: 58 } },
  importedAt: new Date("2026-07-14T12:00:00.000Z")
};

const fangraphsInput: UpsertFangraphsAdvancedStatInput = {
  playerId: 1,
  season: 2024,
  sourceSeason: 2024,
  woba: ".476",
  wrcPlus: 218,
  war: "11.2",
  raw: { WAR: "11.2" },
  importedAt: new Date("2026-07-14T12:00:00.000Z")
};

test("stores MLB season totals and team stints independently", async () => {
  const repository = createMemoryRepository();

  await repository.upsertMlbBattingStat(mlbInput);
  await repository.upsertMlbBattingStat({ ...mlbInput, splitType: "team", team: "NYY" });
  await repository.upsertMlbBattingStat({ ...mlbInput, splitType: "team", team: "SFG" });

  assert.equal(repository.mlbStats.size, 3);
});

test("upserts MLB and FanGraphs records without overwriting either source", async () => {
  const repository = createMemoryRepository();

  await repository.upsertMlbBattingStat(mlbInput);
  await repository.upsertFangraphsAdvancedStat(fangraphsInput);
  await repository.upsertFangraphsAdvancedStat({ ...fangraphsInput, war: "11.3" });

  assert.equal(repository.mlbStats.size, 1);
  assert.equal(repository.fangraphsStats.size, 1);
  assert.equal(repository.fangraphsStats.get("1:2024")?.war, "11.3");
});

test("retains raw payload and import provenance", async () => {
  const repository = createMemoryRepository();

  await repository.upsertMlbBattingStat(mlbInput);

  const stored = repository.mlbStats.get("1:2024:total:");
  assert.deepEqual(stored?.raw, { stats: { homeRuns: 58 } });
  assert.equal(stored?.sourceSeason, 2024);
  assert.equal(stored?.importedAt, mlbInput.importedAt);
});

function createMemoryRepository() {
  const mlbStats = new Map<string, UpsertMlbBattingStatInput>();
  const fangraphsStats = new Map<string, UpsertFangraphsAdvancedStatInput>();

  const repository: BattingRepository & {
    mlbStats: typeof mlbStats;
    fangraphsStats: typeof fangraphsStats;
  } = {
    mlbStats,
    fangraphsStats,
    async transaction(callback) {
      return callback(repository);
    },
    async upsertPlayer() {
      return { id: 1 };
    },
    async upsertMlbBattingStat(input) {
      mlbStats.set(`${input.playerId}:${input.season}:${input.splitType}:${input.team}`, input);
    },
    async upsertFangraphsAdvancedStat(input) {
      fangraphsStats.set(`${input.playerId}:${input.season}`, input);
    }
  };

  return repository;
}
