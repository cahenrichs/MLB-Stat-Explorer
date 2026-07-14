import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const statSource = pgEnum("stat_source", ["mlb", "fangraphs"]);
export const battingSplitType = pgEnum("batting_split_type", ["total", "team"]);

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  mlbamId: integer("mlbam_id").notNull().unique(),
  fangraphsId: integer("fangraphs_id").unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const mlbBattingSeasonStats = pgTable(
  "mlb_batting_season_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    sourceSeason: integer("source_season").notNull(),
    source: statSource("source").notNull().default("mlb"),
    splitType: battingSplitType("split_type").notNull(),
    team: text("team").notNull().default(""),
    games: integer("games"),
    plateAppearances: integer("plate_appearances"),
    atBats: integer("at_bats"),
    runs: integer("runs"),
    hits: integer("hits"),
    doubles: integer("doubles"),
    triples: integer("triples"),
    homeRuns: integer("home_runs"),
    runsBattedIn: integer("runs_batted_in"),
    baseOnBalls: integer("base_on_balls"),
    strikeOuts: integer("strike_outs"),
    stolenBases: integer("stolen_bases"),
    caughtStealing: integer("caught_stealing"),
    hitByPitch: integer("hit_by_pitch"),
    sacBunts: integer("sac_bunts"),
    sacFlies: integer("sac_flies"),
    totalBases: integer("total_bases"),
    groundIntoDoublePlay: integer("ground_into_double_play"),
    avg: numeric("avg", { precision: 5, scale: 3 }),
    obp: numeric("obp", { precision: 5, scale: 3 }),
    slg: numeric("slg", { precision: 5, scale: 3 }),
    ops: numeric("ops", { precision: 5, scale: 3 }),
    raw: jsonb("raw").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    playerSeasonSplitTeamUnique: uniqueIndex(
      "mlb_batting_season_stats_player_season_split_team_idx"
    ).on(table.playerId, table.season, table.splitType, table.team)
  })
);

export const fangraphsBattingAdvancedStats = pgTable(
  "fangraphs_batting_advanced_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    sourceSeason: integer("source_season").notNull(),
    source: statSource("source").notNull().default("fangraphs"),
    woba: numeric("woba", { precision: 5, scale: 3 }),
    wrcPlus: integer("wrc_plus"),
    war: numeric("war", { precision: 5, scale: 1 }),
    raw: jsonb("raw").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    playerSeasonUnique: uniqueIndex("fangraphs_batting_advanced_stats_player_season_idx").on(
      table.playerId,
      table.season
    )
  })
);
