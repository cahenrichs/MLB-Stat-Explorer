# Ingestion

Python scripts for fetching source data live here.

For v1, this package will fetch FanGraphs batting season stats through `pybaseball` and write JSON snapshots into `ingestion/data`.

## Setup

Create and activate a Python virtual environment:

```bash
python3 -m venv ingestion/.venv
source ingestion/.venv/bin/activate
```

Install dependencies:

```bash
python -m pip install -r ingestion/requirements.txt
```

## Automated FanGraphs Fetch

Fetch one batting season through `pybaseball`:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024
```

This writes:

```text
ingestion/data/fangraphs-batting-2024.json
```

## FanGraphs 403

FanGraphs may reject automated requests with an HTTP 403. When that happens, manually download the FanGraphs batting leaderboard CSV for the target season and use the CSV fallback.

## CSV Fallback

Save the manually downloaded CSV somewhere under `ingestion/data`, for example:

```text
ingestion/data/fangraphs-batting-2024.csv
```

Convert it to the JSON snapshot format:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024 --csv ingestion/data/fangraphs-batting-2024.csv
```

The converter adds `Season` when missing, normalizes known FanGraphs header variants, preserves original columns, and validates the required importer fields before writing JSON.

## Import JSON

After creating the JSON snapshot, import it into the database:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-batting --season 2024
```

## Tests

Run the standalone ingestion tests with:

```bash
python -m unittest ingestion/test_fetch_fangraphs_batting.py
```
