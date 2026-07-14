# Data Source Migration Plan

## Goal

Replace pybaseball and FanGraphs as the primary source for the app's batting data. Use the MLB Stats API as the authoritative source for standard MLB batting statistics, player identity, and team splits. Retain manual FanGraphs CSV imports only for the advanced metrics that FanGraphs uniquely provides.

## Scope

- Migrate the existing hitter comparison experience only. Pitching is out of scope.
- Import MLB regular-season batting data for batting-title-qualified hitters.
- Exclude postseason, spring training, minor leagues, and other split types.
- Cleanly re-import the 2024 season through the new pipeline, replacing existing FanGraphs-derived rows.
- Make the importer usable for any requested season going forward.
- During an active season, run the MLB import daily. Treat the final successful import as the season snapshot.

## Sources

### MLB Stats API

The MLB Stats API is the primary source for:

- Canonical player identity through MLBAM ID.
- Standard regular-season batting totals and rates.
- Player season totals and team-stint splits.
- Current and historical season imports.

Store the complete standard batting line even where a field is not yet displayed:

- Games, plate appearances, at-bats, runs, hits, doubles, triples, home runs, RBI.
- Walks, strikeouts, stolen bases, caught stealing, hit by pitch.
- Sacrifice hits, sacrifice flies, total bases, grounded into double plays.
- Standard slash and rate stats supplied by MLB.

The MLB source owns every overlapping standard stat, including games, plate appearances, home runs, AVG, OBP, SLG, and OPS. If the UI retains BB% and K%, derive them from MLB totals rather than importing FanGraphs versions.

### FanGraphs CSV

Use a manual CSV import for only these advanced season-total metrics:

- `wOBA`
- `wRC+`
- FanGraphs WAR (`WAR`/fWAR)

Do not import the entire FanGraphs batting export solely for future use. Do not use pybaseball. Do not scrape FanGraphs.

The CSV importer must:

- Require an MLBAM ID column and match strictly on that ID.
- Require season, `wOBA`, `wRC+`, and `WAR` fields, while allowing documented harmless header aliases.
- Validate IDs, seasons, and numeric values before changing database data.
- Reject malformed files atomically and provide row-level error details.
- Reject unmatched or duplicate MLBAM IDs instead of falling back to player-name matching.
- Replace only that source's advanced record when a valid CSV is imported.

FanGraphs advanced metrics apply only to a player's season-total line. Team stints show MLB standard values only, with advanced metrics marked "Not available."

### Baseball Reference

Defer Baseball Reference support to a separate feature. Before adding it, define the exact Baseball Reference-only metrics needed by the UI and confirm an approved manual export workflow.

### Statcast

Defer Statcast/Baseball Savant to a separate feature. It is appropriate later for pitch and batted-ball metrics such as exit velocity, barrel rate, hard-hit rate, xBA, and xwOBA, but is not a replacement for standard season ingestion and would add a distinct event-data model.

## Data Model

- MLBAM ID is the canonical player identity.
- Keep FanGraphs and future external identifiers as nullable source identifiers.
- Store normalized source records separately rather than overwriting source values.
- Retain raw MLB API payloads and original CSV rows alongside normalized values.
- Store source, source season, `importedAt`, and other freshness/provenance metadata.
- Use idempotent upserts so official MLB scoring corrections replace the prior import's values.

## Season Totals And Team Splits

- Search and selection use a player's season-total row by default.
- The comparison view provides an expandable section for MLB team-stint splits.
- Do not expose individual team stints as separate searchable players.
- Qualified-player filtering applies to the player season total.

## API And UI

Replace the current FanGraphs-only source query with one unified player-season API response:

- Standard MLB statistics are returned as the primary batting line.
- FanGraphs advanced values are returned in a clearly separate advanced section.
- Each section includes source and availability metadata.
- The web app does not join source responses itself.

The UI must:

- Label standard data as "MLB Stats API."
- Label advanced values as "FanGraphs."
- Display each source's last successful import time in a compact details area.
- Display "Not available" when a season has MLB data but the FanGraphs CSV has not been imported.

## Import Reliability

- Implement an idempotent CLI importer for a requested season.
- Validate the complete MLB API response before replacing a season's data.
- Perform replacement in a transaction.
- If an import fails, preserve the last successful import and report the failure.
- Do not leave a season partially refreshed.

## Verification

- Add unit tests for MLB mapping, qualified-player filtering, source provenance, team-total and team-split behavior, CSV validation, identity matching, and transaction rollback.
- Add integration coverage using a recorded MLB API fixture.
- After implementation, manually import 2024 and spot-check several players against official MLB totals, including at least one traded player.
