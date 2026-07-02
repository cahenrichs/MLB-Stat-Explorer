CREATE TYPE "public"."stat_source" AS ENUM('fangraphs');--> statement-breakpoint
CREATE TABLE "player_batting_season_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"season" integer NOT NULL,
	"team" text,
	"source" "stat_source" DEFAULT 'fangraphs' NOT NULL,
	"games" integer,
	"plate_appearances" integer,
	"home_runs" integer,
	"runs" integer,
	"runs_batted_in" integer,
	"stolen_bases" integer,
	"walk_rate" numeric(6, 2),
	"strikeout_rate" numeric(6, 2),
	"avg" numeric(5, 3),
	"obp" numeric(5, 3),
	"slg" numeric(5, 3),
	"ops" numeric(5, 3),
	"woba" numeric(5, 3),
	"wrc_plus" integer,
	"war" numeric(5, 1),
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"fangraphs_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_fangraphs_id_unique" UNIQUE("fangraphs_id")
);
--> statement-breakpoint
ALTER TABLE "player_batting_season_stats" ADD CONSTRAINT "player_batting_season_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_batting_season_stats_source_season_player_id_idx" ON "player_batting_season_stats" USING btree ("source","season","player_id");