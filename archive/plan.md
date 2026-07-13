# Plan

## Objective

This is v2. Add FanGraphs pitching stats so the app can compare pitchers against pitchers while preserving the existing batter-vs-batter comparison flow.

The app must not allow hitting stats to be compared against pitching stats. Users should explicitly choose between `Batting` and `Pitching` modes, and each mode should have its own search results, selected players, comparison stats, and API data shape.

## Scope

Included in v2:

- FanGraphs-only pitching data.
- Season-level MLB pitcher stats only.
- A pitching ingestion proof/spike before schema/API/UI work.
- A new `player_pitching_season_stats` table parallel to the existing batting table.
- A stored pitcher primary role: `starter` or `reliever`.
- A new `pitcher_primary_role` DB enum.
- A new FanGraphs pitching JSON snapshot format: `ingestion/data/fangraphs-pitching-YYYY.json`.
- A TypeScript importer for FanGraphs pitching snapshots.
- A `GET /pitching-stats` API endpoint.
- Mode-aware seasons through `GET /seasons?mode=batting|pitching`, defaulting to batting.
- A frontend mode switch for `Batting` and `Pitching`.
- URL support for `mode`, for example `?mode=pitching&season=2024&search=skubal`.
- Clear selected players when mode changes.
- Pitcher role badges in pitching search results, selected-player cards, and comparison labels.
- Automated tests for ingestion, DB import, API, and stat utility behavior.

Pitching comparison stats:

- `G`
- `GS`
- `IP`
- `W`
- `L`
- `SV`
- `ERA`
- `WHIP`
- `K%`
- `BB%`
- `K-BB%`
- `HR/9`
- `FIP`
- `xFIP`
- `SIERA`
- `WAR`

Pitching search preview columns:

- `Player`
- `Team`
- `Role`
- `G`
- `GS`
- `IP`
- `ERA`
- `WHIP`
- `WAR`

## Out of Scope

Not included in v2:

- Baseball Reference data.
- Cross-source comparison.
- Hitter-vs-pitcher comparison.
- Team stat pages.
- Career totals.
- Date ranges.
- Multi-season bulk import.
- Pitcher role filtering.
- Starter-vs-reliever comparison restrictions.
- Preserving team split rows.
- Full leaderboard/table explorer behavior.
- Adding every available FanGraphs pitching column.

Team split rows are intentionally deferred. v2 should import total season rows only, matching current batting behavior.

## Current State

The app currently supports FanGraphs batting season comparison.

Current flow:

- Python ingestion fetches FanGraphs batting data through `pybaseball` or converts a manually downloaded CSV fallback.
- Batting snapshots are written to `ingestion/data/fangraphs-batting-YYYY.json`.
- TypeScript DB import maps selected FanGraphs batting fields into `player_batting_season_stats`.
- The shared `players` table stores FanGraphs player identity.
- The API exposes `GET /batting-stats` and `GET /seasons`.
- The React app lets users choose a season, search hitters, select two hitters, and compare batting stats.

Important current constraints:

- `players` is shared and keyed by `fangraphsId`.
- `stat_source` currently only supports `fangraphs`; this should remain unchanged for v2.
- Batting currently imports total rows only for multi-team players.
- Existing tests cover batting ingestion/import/API/stat utilities and should be mirrored for pitching.

## Proposed Approach

1. Prove pitching data can be fetched first.
2. Inspect actual `pybaseball.pitching_stats(...)` output or a FanGraphs pitching CSV export before locking required headers.
3. Add pitching ingestion with the same snapshot approach as batting.
4. Add a dedicated pitching stats DB table.
5. Add a stored pitcher role derived during import.
6. Add a pitching importer and package script.
7. Add a dedicated pitching API endpoint.
8. Make seasons mode-aware.
9. Update frontend mode handling.
10. Add tests at every changed layer.

### Data Fetching

Create `ingestion/fetch_fangraphs_pitching.py`.

It should mirror `fetch_fangraphs_batting.py`:

- Fetch one season at a time.
- Use `pybaseball` first.
- Support `--csv` fallback when FanGraphs blocks automated access.
- Normalize known header aliases.
- Validate required fields.
- Preserve original source columns.
- Write `ingestion/data/fangraphs-pitching-YYYY.json`.

The first implementation task should be a spike to confirm actual headers for:

- `IDfg`
- `Name`
- `Season`
- `Team`
- `G`
- `GS`
- `IP`
- `W`
- `L`
- `SV`
- `ERA`
- `WHIP`
- `K%`
- `BB%`
- `K-BB%`
- `HR/9`
- `FIP`
- `xFIP`
- `SIERA`
- `WAR`

These required fields are provisional until the fetch spike confirms real FanGraphs/pybaseball headers.

### Database

Add a new enum:

- `pitcher_primary_role`: `starter | reliever`

Add a new table:

- `player_pitching_season_stats`

Expected fields:

- `id`
- `playerId`
- `season`
- `team`
- `source`
- `primaryRole`
- `games`
- `gamesStarted`
- `inningsPitched`
- `wins`
- `losses`
- `saves`
- `era`
- `whip`
- `strikeoutRate`
- `walkRate`
- `strikeoutMinusWalkRate`
- `homeRunsPerNine`
- `fip`
- `xfip`
- `siera`
- `war`
- `raw`
- `createdAt`
- `updatedAt`

Add a unique index on:

- `source`
- `season`
- `playerId`

Keep using the shared `players` table. Do not create separate batter/pitcher identity tables.

### Pitcher Role

Store `primaryRole` during import.

Role rule:

- `starter` when `GS >= G * 0.5`
- `reliever` otherwise

Role affects display only. It must not restrict pitcher-vs-pitcher comparison.

The frontend should use the stored/API-provided `primaryRole`; it should not recalculate role from `G` and `GS`.

### API

Keep explicit stat endpoints:

- `GET /batting-stats`
- `GET /pitching-stats`

Make seasons mode-aware:

- `GET /seasons?mode=batting|pitching`

Default mode:

- `batting`

Pitching sort fields for v2:

- `playerName`
- `era`
- `whip`
- `strikeoutRate`
- `war`

Default sorting should remain name-oriented for search:

- `playerName asc`

### Frontend

Add a `mode` control near season/search controls:

- `Batting`
- `Pitching`

Mode behavior:

- Default to `batting`.
- Read/write `mode` in the URL.
- Clear selected players when mode changes.
- Load seasons for the active mode.
- Fetch batting rows from `/batting-stats`.
- Fetch pitching rows from `/pitching-stats`.
- Show batting-specific columns/stats in batting mode.
- Show pitching-specific columns/stats in pitching mode.
- Show role badges only in pitching mode.

Pitcher role display:

- Show compact badges for `Starter` and `Reliever`.
- Use different colors for the two roles.
- Prefer badges over full-row highlighting to avoid conflicts with selected-row and winner styling.
- Show role in comparison labels, for example `Tarik Skubal (Starter)`.

## Task Breakdown

1. Run a pitching data fetch spike.
2. Confirm actual FanGraphs/pybaseball pitching headers.
3. Add `fetch_fangraphs_pitching.py`.
4. Add ingestion tests for pitching header aliases, required fields, and CSV fallback.
5. Add `pitcher_primary_role` enum and `player_pitching_season_stats` table.
6. Generate a Drizzle migration.
7. Add `fangraphsPitching.ts` DB importer.
8. Add importer tests for mapping, parsing, role derivation, total-row selection, and repository upsert behavior.
9. Add `importFangraphsPitching.ts` script.
10. Add package scripts for `import:fangraphs-pitching`.
11. Add `GET /pitching-stats`.
12. Update `GET /seasons` to accept `mode`.
13. Add API tests for pitching stats and mode-aware seasons.
14. Add pitching row/stat types in the web app.
15. Add mode state and URL handling.
16. Update fetching logic to branch by mode.
17. Add pitching search result columns.
18. Add role badges.
19. Add pitching comparison stats and winner directions.
20. Add frontend utility tests.
21. Run ingestion, DB, API, web, typecheck, and build validation.

## Decisions

- Use separate batting and pitching modes because hitter-vs-pitcher comparison should be impossible by design.
- Stay FanGraphs-only for v2 to avoid source reconciliation and identity-matching complexity.
- Store pitching stats in a separate table because pitching has different fields and comparison semantics.
- Keep one shared `players` table because FanGraphs identity belongs to the player, not the stat category.
- Support two-way players by showing the same player in whichever mode has matching stats.
- Clear selected players on mode change to prevent stale cross-mode selections.
- Add `mode` to the URL for predictable refresh/share behavior.
- Keep separate `/batting-stats` and `/pitching-stats` endpoints because response shapes differ.
- Use CSV fallback if FanGraphs blocks automated pitching fetches.
- Import total season rows only for v2.
- Store `primaryRole` in the pitching stats table because it is expected to be useful soon.
- Derive `primaryRole` from `G` and `GS` during import.
- Use a DB enum for pitcher role to avoid invalid role strings.
- Use role badges as display context only.
- Default to batting because there are more batters than pitchers and it preserves current behavior.
- Import all pitchers with `qual=0`; do not filter by innings or role in v2.
- Add tests as part of v2, not as a follow-up.

## Risks / Unknowns

- FanGraphs may block automated pybaseball pitching requests.
- Pitching headers may differ between pybaseball output and manual CSV export.
- Required pitching fields are provisional until the fetch spike confirms real headers.
- FanGraphs may use different names for `K-BB%`, `HR/9`, `xFIP`, or `SIERA`.
- Innings pitched may need decimal/baseball-specific parsing if FanGraphs represents partial innings unusually.
- Multi-team pitcher rows may be ambiguous if no clear total row exists.
- Role derivation may classify edge cases imperfectly, but it is acceptable for v2 display context.
- Adding mode-aware seasons changes existing `/seasons` behavior and needs regression coverage.
- UI branching may get noisy if kept entirely inside `App.tsx`; keep changes minimal first, then extract only if necessary.

## Validation

Data validation:

- `python -m unittest ingestion/test_fetch_fangraphs_batting.py`
- `python -m unittest ingestion/test_fetch_fangraphs_pitching.py`
- `python ingestion/fetch_fangraphs_pitching.py --season 2024`
- If blocked, test CSV fallback with `--csv`.

Import validation:

- `corepack pnpm --filter @mlb-stat-explorer/db test`
- `corepack pnpm import:fangraphs-pitching --season 2024`

API validation:

- `corepack pnpm --filter @mlb-stat-explorer/api test`

Frontend validation:

- `corepack pnpm --filter @mlb-stat-explorer/web test`
- `corepack pnpm --filter @mlb-stat-explorer/web typecheck`
- `corepack pnpm --filter @mlb-stat-explorer/web build`

Repo validation:

- `corepack pnpm -r typecheck`
- `corepack pnpm -r build`

Done means:

- A pitching JSON snapshot can be produced for at least one season.
- Pitching data can be imported into PostgreSQL.
- `/pitching-stats` returns typed pitcher rows without raw source data.
- `/seasons?mode=pitching` returns only pitching seasons.
- The UI can switch between batting and pitching.
- Users can compare two batters or two pitchers.
- Users cannot compare a batter against a pitcher.
- Pitcher role appears as a stored/displayed badge.
- Automated tests cover the new ingestion, import, API, and frontend utility behavior.
