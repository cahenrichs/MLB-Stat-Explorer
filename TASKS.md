# Tasks

## Active

- [ ] 6. Cut over 2024 and document operations
  - Status: In progress
  - Blocked by: A fresh manually acquired 2024 FanGraphs advanced CSV
  - End-to-end deliverable: A clean 2024 import using the new MLB and FanGraphs pipelines, removal of obsolete FanGraphs-derived database rows/snapshots, and operator documentation for daily MLB imports and manual FanGraphs advanced CSV imports.
  - Acceptance criteria:
    - 2024 standard data is re-imported from MLB rather than migrated from existing FanGraphs rows.
    - A fresh 2024 FanGraphs advanced CSV is imported after the MLB season import.
    - Several players are checked against official MLB totals, including at least one traded player.
    - The README documents daily in-season MLB imports, final-season snapshots, manual FanGraphs CSV workflow, and failure behavior.
    - No Baseball Reference or Statcast ingestion is introduced.
  - Verification commands:
    - `corepack pnpm db:migrate`
    - `DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:mlb-batting --season 2024`
    - `DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-advanced --season 2024 --csv ingestion/data/fangraphs-advanced-2024.csv`
    - `corepack pnpm typecheck`
    - `corepack pnpm build`

- [x] 4. Expose a unified player-season API
  - Status: Completed
  - Blocked by: Tasks 1, 2, and 3
  - End-to-end deliverable: API endpoints that return an MLB-primary player-season response with separately labeled FanGraphs advanced metrics, source availability, import timestamps, and MLB team splits.
  - Acceptance criteria:
    - The API no longer exposes the current FanGraphs-only source-selection model.
    - Standard values are returned from MLB records and advanced values from FanGraphs records.
    - A missing FanGraphs import is represented as unavailable rather than as stale, empty, or substituted data.
    - The API exposes season totals for comparison and team splits for detail display.
    - API tests cover serialization, provenance, unavailable advanced metrics, and a traded player.
  - Verification commands:
    - `corepack pnpm --filter @mlb-stat-explorer/api test`
    - `corepack pnpm typecheck`

## Completed

- [x] 5. Update the comparison UI for unified provenance and splits
  - Status: Completed
  - Blocked by: Task 4
  - End-to-end deliverable: The existing hitter comparison UI displays MLB standard stats, FanGraphs advanced metrics, per-source labels and refresh times, and expandable MLB team-stint details.
  - Acceptance criteria:
    - Search selects one player season-total row, never a separate team-stint player.
    - Standard stats are labeled "MLB Stats API" and advanced values are labeled "FanGraphs."
    - Missing FanGraphs values display "Not available."
    - A compact details area displays each source's last successful import time.
    - Team splits are expandable beneath the selected season total and do not show FanGraphs advanced metrics.
  - Verification commands:
    - `corepack pnpm --filter @mlb-stat-explorer/web test`
    - `corepack pnpm typecheck`
    - `corepack pnpm build`

- [x] 3. Replace pybaseball with minimal FanGraphs CSV import
  - Status: Completed
  - Blocked by: Task 1
  - End-to-end deliverable: A validated manual FanGraphs CSV importer for season-total `wOBA`, `wRC+`, and fWAR that strictly joins rows to MLB players through MLBAM ID.
  - Acceptance criteria:
    - `pybaseball` is removed from runtime dependencies and ingestion documentation.
    - The importer requires documented MLBAM ID, season, `wOBA`, `wRC+`, and `WAR` fields while accepting documented header aliases.
    - Invalid values, duplicate IDs, and IDs not known to the MLB import cause an atomic failure with row-level errors.
    - There is no player-name matching or automated FanGraphs request.
    - Advanced values are stored only against a season-total record.
  - Verification commands:
    - `corepack pnpm --filter @mlb-stat-explorer/db test`
    - `corepack pnpm typecheck`
    - `DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-advanced --season 2024 --csv ingestion/data/fangraphs-advanced-2024.csv`

- [x] 2. Build the qualified-hitter MLB season importer
  - Status: Completed
  - Blocked by: None
  - End-to-end deliverable: An idempotent CLI command that fetches one requested MLB regular season from the MLB Stats API and atomically stores standard batting totals for batting-title-qualified hitters, including their team-stint splits.
  - Acceptance criteria:
    - The importer accepts a season argument and supports 2024 and later seasons.
    - It imports the complete standard batting line, not only current UI fields.
    - It filters to batting-title-qualified hitters and excludes postseason, spring training, minor leagues, and unrelated split types.
    - A traded player's season total is stored with distinct team stints.
    - Re-running the command upserts corrections and refreshes provenance timestamps.
    - Invalid or incomplete API responses leave the prior season import untouched.
  - Verification commands:
    - `corepack pnpm --filter @mlb-stat-explorer/db test`
    - `corepack pnpm typecheck`
    - `DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:mlb-batting --season 2024`

- [x] 1. Define source-aware batting storage
  - Status: Completed
  - Blocked by: None
  - End-to-end deliverable: A database migration and typed data-access layer that use MLBAM as canonical player identity, store separate MLB standard-stat and FanGraphs advanced-stat records, preserve raw source payloads, track provenance/import timestamps, and support season totals plus team stints.
  - Acceptance criteria:
    - Existing FanGraphs-only source assumptions are removed from schema types and constraints.
    - Source records can be independently upserted for the same player and season without overwriting one another.
    - MLB season totals and individual team stints are representable.
    - Raw payload, source, source season, and import timestamp are retained.
  - Verification commands:
    - `corepack pnpm db:generate`
    - `corepack pnpm db:migrate`
    - `corepack pnpm --filter @mlb-stat-explorer/db test`
    - `corepack pnpm typecheck`
