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

export const statSource = pgEnum("stat_source", ["fangraphs"]);

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  fangraphsId: integer("fangraphs_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const playerBattingSeasonStats = pgTable(
  "player_batting_season_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    team: text("team"),
    source: statSource("source").notNull().default("fangraphs"),
    games: integer("games"),
    plateAppearances: integer("plate_appearances"),
    homeRuns: integer("home_runs"),
    runs: integer("runs"),
    runsBattedIn: integer("runs_batted_in"),
    stolenBases: integer("stolen_bases"),
    walkRate: numeric("walk_rate", { precision: 6, scale: 2 }),
    strikeoutRate: numeric("strikeout_rate", { precision: 6, scale: 2 }),
    avg: numeric("avg", { precision: 5, scale: 3 }),
    obp: numeric("obp", { precision: 5, scale: 3 }),
    slg: numeric("slg", { precision: 5, scale: 3 }),
    ops: numeric("ops", { precision: 5, scale: 3 }),
    woba: numeric("woba", { precision: 5, scale: 3 }),
    wrcPlus: integer("wrc_plus"),
    war: numeric("war", { precision: 5, scale: 1 }),
    raw: jsonb("raw").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceSeasonPlayerUnique: uniqueIndex(
      "player_batting_season_stats_source_season_player_id_idx"
    ).on(table.source, table.season, table.playerId)
  })
);
