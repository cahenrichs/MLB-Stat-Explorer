import assert from "node:assert/strict";
import test from "node:test";
import type {
  BattingRepository,
  UpsertFangraphsAdvancedStatInput,
  UpsertMlbBattingStatInput
} from "../battingRepository.js";
import { importMlbQualifiedBattingSeason } from "./mlbBatting.js";

test("imports qualified season totals and distinct team stints", async () => {
  const repository = createMemoryRepository();
  const result = await importMlbQualifiedBattingSeason({
    season: 2024,
    repository,
    fetch: createFetch(playerResponse())
  });

  assert.deepEqual(result, { players: 1, stats: 3 });
  assert.equal(repository.players.get(650333)?.name, "Luis Arraez");
  assert.equal(repository.mlbStats.size, 3);
  assert.equal(repository.mlbStats.get("1:2024:total:")?.runsBattedIn, 46);
  assert.equal(repository.mlbStats.get("1:2024:team:Miami Marlins")?.games, 33);
  assert.equal(repository.mlbStats.get("1:2024:team:San Diego Padres")?.hits, 159);
});

test("upserts a re-import and refreshes its provenance timestamp", async () => {
  const repository = createMemoryRepository();
  let rbi = 46;
  const fetch = async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.includes("/people/") ? playerResponse() : leaderboardResponse(rbi++)
  });

  await importMlbQualifiedBattingSeason({ season: 2024, repository, fetch });
  const firstImportedAt = repository.mlbStats.get("1:2024:total:")?.importedAt;
  await importMlbQualifiedBattingSeason({ season: 2024, repository, fetch });

  assert.equal(repository.mlbStats.size, 3);
  assert.equal(repository.mlbStats.get("1:2024:total:")?.runsBattedIn, 47);
  assert.notEqual(repository.mlbStats.get("1:2024:total:")?.importedAt, firstImportedAt);
});

test("rejects incomplete API data without changing the previous import", async () => {
  const repository = createMemoryRepository();
  await importMlbQualifiedBattingSeason({
    season: 2024,
    repository,
    fetch: createFetch(playerResponse())
  });
  const before = new Map(repository.mlbStats);
  const invalid = playerResponse();
  const team = invalid.stats[0]?.splits[1];
  if (!team) {
    throw new Error("Test fixture is missing its team split");
  }
  delete (team.stat as Record<string, unknown>).ops;

  await assert.rejects(
    importMlbQualifiedBattingSeason({ season: 2024, repository, fetch: createFetch(invalid) }),
    /ops is invalid/
  );

  assert.deepEqual(repository.mlbStats, before);
});

test("rejects seasons before 2024 before making requests", async () => {
  await assert.rejects(
    importMlbQualifiedBattingSeason({
      season: 2023,
      repository: createMemoryRepository(),
      fetch: async () => {
        throw new Error("should not fetch");
      }
    }),
    /2024 onward/
  );
});

function createFetch(player: ReturnType<typeof playerResponse>) {
  return async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (url.includes("/people/") ? player : leaderboardResponse())
  });
}

function leaderboardResponse(rbi = 46) {
  return {
    stats: [
      {
        splits: [
          {
            player: { id: 650333, fullName: "Luis Arraez" },
            stat: statLine(rbi),
            team: { name: "Miami Marlins" }
          }
        ]
      }
    ]
  };
}

function playerResponse(rbi = 46) {
  return {
    stats: [
      {
        splits: [
          { stat: statLine(rbi) },
          { stat: statLine(41, { gamesPlayed: 117, hits: 159 }), team: { name: "San Diego Padres" } },
          { stat: statLine(5, { gamesPlayed: 33, hits: 41 }), team: { name: "Miami Marlins" } }
        ]
      }
    ]
  };
}

function statLine(rbi: number, overrides: Record<string, number | string> = {}) {
  return {
    gamesPlayed: 150,
    plateAppearances: 672,
    atBats: 637,
    runs: 83,
    hits: 200,
    doubles: 32,
    triples: 3,
    homeRuns: 4,
    rbi,
    baseOnBalls: 24,
    strikeOuts: 29,
    stolenBases: 9,
    caughtStealing: 3,
    hitByPitch: 8,
    sacBunts: 2,
    sacFlies: 1,
    totalBases: 250,
    groundIntoDoublePlay: 18,
    avg: ".314",
    obp: ".346",
    slg: ".392",
    ops: ".738",
    ...overrides
  };
}

function createMemoryRepository(
  players = new Map<number, { id: number; name: string }>(),
  mlbStats = new Map<string, UpsertMlbBattingStatInput>(),
  fangraphsStats = new Map<string, UpsertFangraphsAdvancedStatInput>()
) {

  const repository: BattingRepository & {
    players: typeof players;
    mlbStats: typeof mlbStats;
    fangraphsStats: typeof fangraphsStats;
  } = {
    players,
    mlbStats,
    fangraphsStats,
    async transaction(callback) {
      const staged = createMemoryRepository(
        new Map(players),
        new Map(mlbStats),
        new Map(fangraphsStats)
      );
      const result = await callback(staged);
      players.clear();
      staged.players.forEach((value, key) => players.set(key, value));
      mlbStats.clear();
      staged.mlbStats.forEach((value, key) => mlbStats.set(key, value));
      return result;
    },
    async upsertPlayer(input) {
      const existing = players.get(input.mlbamId);
      const player = { id: existing?.id ?? players.size + 1, name: input.name };
      players.set(input.mlbamId, player);
      return player;
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
