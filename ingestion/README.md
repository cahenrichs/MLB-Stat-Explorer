# Ingestion Operations

Standard batting data comes from the MLB Stats API. FanGraphs advanced metrics are imported from a manually acquired CSV. The application makes no automated FanGraphs request and does not use player-name matching.

## Prerequisites

Start PostgreSQL with `docker compose up -d postgres`, set `DATABASE_URL` if it differs from the local development database, and apply pending migrations:

```bash
corepack pnpm db:migrate
```

## Daily In-Season Import

Run the MLB import once per day during the regular season. It fetches batting-title-qualified regular-season hitters and writes MLB season totals plus team stints in one transaction:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:mlb-batting --season 2024
```

Re-running the command upserts MLB scoring corrections and refreshes import timestamps. After the season ends, the final successful MLB import is the season snapshot; no separate snapshot command or data copy is needed.

## FanGraphs Advanced CSV

After a successful MLB import, export a fresh season-total FanGraphs CSV and save it outside version control, for example as `ingestion/data/fangraphs-advanced-2024.csv`. Then run:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-advanced --season 2024 --csv ingestion/data/fangraphs-advanced-2024.csv
```

The MLB import must run first so every CSV MLBAM ID can be verified. This command replaces only the imported season-total FanGraphs advanced records. It never changes MLB standard totals or team splits.

## CSV Format

The CSV must include one row per player-season and these fields:

| Field | Accepted headers |
| --- | --- |
| MLBAM ID | `MLBAM ID`, `MLBAMID`, `MLBAM_ID` |
| Season | `Season`, `Year` |
| wOBA | `wOBA` |
| wRC+ | `wRC+`, `wRC Plus` |
| FanGraphs WAR | `WAR`, `fWAR` |

Every row's season must match `--season`. The importer rejects invalid values, duplicate MLBAM IDs, IDs absent from the MLB import, missing fields, and malformed CSV rows. It reports every detected row error and writes nothing when any error is found. Only `wOBA`, `wRC+`, and `WAR` are stored, exclusively as season-total FanGraphs values; the original CSV row is retained for provenance.

## Failure Behavior

If the MLB API response is unavailable, malformed, or incomplete, the import fails before its transaction begins. If a database write fails, the transaction rolls back. The last successful season data remains available in either case.

If the FanGraphs CSV is invalid or contains an ID missing from the MLB import, it reports row-level errors and writes no advanced records. Correct the CSV and rerun it; do not substitute player-name matching or manually modify imported rows.

## 2024 Cutover

Run the MLB import before importing the fresh 2024 FanGraphs CSV:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:mlb-batting --season 2024
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-advanced --season 2024 --csv ingestion/data/fangraphs-advanced-2024.csv
```

The source-aware migration removes the previous FanGraphs-derived batting rows and snapshots. Spot-check imported MLB season totals against the official MLB Stats API, including several qualified hitters and at least one traded player, before declaring the cutover complete.
