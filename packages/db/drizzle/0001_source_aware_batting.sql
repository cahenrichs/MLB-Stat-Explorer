DROP TABLE "player_batting_season_stats";
--> statement-breakpoint
DROP TABLE "players";
--> statement-breakpoint
DROP TYPE "stat_source";
--> statement-breakpoint
CREATE TYPE "stat_source" AS ENUM ('mlb', 'fangraphs');
--> statement-breakpoint
CREATE TYPE "batting_split_type" AS ENUM ('total', 'team');
--> statement-breakpoint
CREATE TABLE "players" (
  "id" serial PRIMARY KEY NOT NULL,
  "mlbam_id" integer NOT NULL,
  "fangraphs_id" integer,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "players_mlbam_id_unique" UNIQUE("mlbam_id"),
  CONSTRAINT "players_fangraphs_id_unique" UNIQUE("fangraphs_id")
);
--> statement-breakpoint
CREATE TABLE "mlb_batting_season_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "player_id" integer NOT NULL,
  "season" integer NOT NULL,
  "source_season" integer NOT NULL,
  "source" "stat_source" DEFAULT 'mlb' NOT NULL,
  "split_type" "batting_split_type" NOT NULL,
  "team" text DEFAULT '' NOT NULL,
  "games" integer,
  "plate_appearances" integer,
  "at_bats" integer,
  "runs" integer,
  "hits" integer,
  "doubles" integer,
  "triples" integer,
  "home_runs" integer,
  "runs_batted_in" integer,
  "base_on_balls" integer,
  "strike_outs" integer,
  "stolen_bases" integer,
  "caught_stealing" integer,
  "hit_by_pitch" integer,
  "sac_bunts" integer,
  "sac_flies" integer,
  "total_bases" integer,
  "ground_into_double_play" integer,
  "avg" numeric(5, 3),
  "obp" numeric(5, 3),
  "slg" numeric(5, 3),
  "ops" numeric(5, 3),
  "raw" jsonb NOT NULL,
  "imported_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mlb_batting_season_stats_player_season_split_team_idx"
  ON "mlb_batting_season_stats" USING btree ("player_id", "season", "split_type", "team");
--> statement-breakpoint
CREATE TABLE "fangraphs_batting_advanced_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "player_id" integer NOT NULL,
  "season" integer NOT NULL,
  "source_season" integer NOT NULL,
  "source" "stat_source" DEFAULT 'fangraphs' NOT NULL,
  "woba" numeric(5, 3),
  "wrc_plus" integer,
  "war" numeric(5, 1),
  "raw" jsonb NOT NULL,
  "imported_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fangraphs_batting_advanced_stats_player_season_unique" UNIQUE("player_id", "season")
);
--> statement-breakpoint
ALTER TABLE "mlb_batting_season_stats"
  ADD CONSTRAINT "mlb_batting_season_stats_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fangraphs_batting_advanced_stats"
  ADD CONSTRAINT "fangraphs_batting_advanced_stats_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE cascade;
