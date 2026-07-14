import { eq } from "drizzle-orm";
import { db, type Db } from "./client.js";
import { fangraphsBattingAdvancedStats, mlbBattingSeasonStats, players } from "./schema.js";

type RawPayload = Record<string, unknown>;

export type UpsertPlayerInput = {
  mlbamId: number;
  name: string;
  fangraphsId?: number | null;
};

export type UpsertMlbBattingStatInput = {
  playerId: number;
  season: number;
  sourceSeason: number;
  splitType: "total" | "team";
  team: string;
  games: number | null;
  plateAppearances: number | null;
  atBats: number | null;
  runs: number | null;
  hits: number | null;
  doubles: number | null;
  triples: number | null;
  homeRuns: number | null;
  runsBattedIn: number | null;
  baseOnBalls: number | null;
  strikeOuts: number | null;
  stolenBases: number | null;
  caughtStealing: number | null;
  hitByPitch: number | null;
  sacBunts: number | null;
  sacFlies: number | null;
  totalBases: number | null;
  groundIntoDoublePlay: number | null;
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
  raw: RawPayload;
  importedAt: Date;
};

export type UpsertFangraphsAdvancedStatInput = {
  playerId: number;
  season: number;
  sourceSeason: number;
  woba: string | null;
  wrcPlus: number | null;
  war: string | null;
  raw: RawPayload;
  importedAt: Date;
};

export type BattingRepository = {
  transaction<T>(callback: (repository: BattingRepository) => Promise<T>): Promise<T>;
  findPlayerByMlbamId(mlbamId: number): Promise<{ id: number } | null>;
  upsertPlayer(input: UpsertPlayerInput): Promise<{ id: number }>;
  upsertMlbBattingStat(input: UpsertMlbBattingStatInput): Promise<void>;
  upsertFangraphsAdvancedStat(input: UpsertFangraphsAdvancedStatInput): Promise<void>;
};

export function createBattingRepository(database: Db = db): BattingRepository {
  function createRepository(transactionDatabase: Db): BattingRepository {
    return createBattingRepository(transactionDatabase);
  }

  return {
    async transaction(callback) {
      return database.transaction((transaction) =>
        callback(createRepository(transaction as unknown as Db))
      );
    },

    async findPlayerByMlbamId(mlbamId) {
      const [player] = await database
        .select({ id: players.id })
        .from(players)
        .where(eq(players.mlbamId, mlbamId));
      return player ?? null;
    },

    async upsertPlayer(input) {
      const now = new Date();
      const [player] = await database
        .insert(players)
        .values({ ...input, updatedAt: now })
        .onConflictDoUpdate({
          target: players.mlbamId,
          set: {
            name: input.name,
            fangraphsId: input.fangraphsId,
            updatedAt: now
          }
        })
        .returning({ id: players.id });

      if (!player) {
        throw new Error(`Failed to upsert MLBAM player ${input.mlbamId}`);
      }

      return player;
    },

    async upsertMlbBattingStat(input) {
      const now = new Date();
      await database
        .insert(mlbBattingSeasonStats)
        .values({ ...input, source: "mlb", updatedAt: now })
        .onConflictDoUpdate({
          target: [
            mlbBattingSeasonStats.playerId,
            mlbBattingSeasonStats.season,
            mlbBattingSeasonStats.splitType,
            mlbBattingSeasonStats.team
          ],
          set: { ...input, source: "mlb", updatedAt: now }
        });
    },

    async upsertFangraphsAdvancedStat(input) {
      const now = new Date();
      await database
        .insert(fangraphsBattingAdvancedStats)
        .values({ ...input, source: "fangraphs", updatedAt: now })
        .onConflictDoUpdate({
          target: [
            fangraphsBattingAdvancedStats.playerId,
            fangraphsBattingAdvancedStats.season
          ],
          set: { ...input, source: "fangraphs", updatedAt: now }
        });
    }
  };
}
