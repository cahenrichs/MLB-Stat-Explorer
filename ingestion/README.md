# Ingestion

FanGraphs advanced metrics are imported from a manually acquired CSV. The application makes no automated FanGraphs request and does not use player-name matching.

First import the target MLB season so every CSV MLBAM ID can be verified:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:mlb-batting --season 2024
```

Save a season-total FanGraphs CSV, for example at `ingestion/data/fangraphs-advanced-2024.csv`, then run:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-advanced --season 2024 --csv ingestion/data/fangraphs-advanced-2024.csv
```

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
