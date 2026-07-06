# FanGraphs Fetch/Download Fix Notes

## Problem

The local app setup now works, but the FanGraphs ingestion fetch is blocked before it can create the JSON snapshot.

Observed command:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024
```

Observed failure:

```text
requests.exceptions.HTTPError: Error accessing 'https://www.fangraphs.com/leaders-legacy.aspx'. Received status code 403
```

This means `pybaseball` reached FanGraphs, but FanGraphs rejected the automated request. The database, migrations, importer, API, and frontend are separate from this issue.

## Confirmed Local Environment Details

- PostgreSQL is running through Docker Compose on host port `5433` because host port `5432` was already in use.
- Working database URL:

```text
postgres://mlb:mlb@localhost:5433/mlb_stat_explorer
```

- Migration succeeded with:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm db:migrate
```

- A local sample JSON file was created so the app can run without FanGraphs:

```text
ingestion/data/fangraphs-batting-2024.json
```

- Sample import succeeded:

```text
Imported 8 FanGraphs batting rows for 2024
```

## Current Workaround

Use the sample JSON file already present locally, then run:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-batting --season 2024
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm dev
```

Open:

```text
http://localhost:5173
```

Search names such as `Judge`, `Ohtani`, `Soto`, `Witt`, or `Harper`.

## Script Change Already Made

`ingestion/fetch_fangraphs_batting.py` now supports a manual CSV fallback:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024 --csv path/to/fangraphs.csv
```

That fallback reads the CSV with pandas, adds `Season` if missing, and writes the normal JSON snapshot to:

```text
ingestion/data/fangraphs-batting-2024.json
```

Then the existing TypeScript importer can run unchanged.

## Fix Options

### Option 1: Manual CSV Export Fallback

This is the lowest-risk path.

1. Open FanGraphs in a browser.
2. Navigate to the batting leaderboard for the target season.
3. Export/download the CSV manually.
4. Save it into the project, for example:

```text
ingestion/data/fangraphs-batting-2024.csv
```

5. Convert CSV to JSON:

```bash
source ingestion/.venv/bin/activate
python ingestion/fetch_fangraphs_batting.py --season 2024 --csv ingestion/data/fangraphs-batting-2024.csv
```

6. Import JSON:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-batting --season 2024
```

Potential issue: the downloaded CSV may use different column names than `pybaseball`. The importer currently requires:

```text
IDfg, Name, Season, Team, G, PA, HR, R, RBI, SB, BB%, K%, AVG, OBP, SLG, OPS, wOBA, wRC+, WAR
```

If import fails with a missing field error, inspect the CSV header and add a small normalization step in `fetch_fangraphs_batting.py`.

### Option 2: Improve CSV Header Normalization

Add a function in `ingestion/fetch_fangraphs_batting.py` to normalize common FanGraphs CSV header variants before writing JSON.

Examples to handle:

```text
PlayerName -> Name
NameASCII -> Name
playerid -> IDfg
IDfg+ -> IDfg
TeamNameAbb -> Team
BB% as BB_pct or BB_percent -> BB%
K% as K_pct or K_percent -> K%
wRCPlus -> wRC+
```

Keep this mapping explicit and small. Do not create a generic stat-definition system yet.

### Option 3: Add A Different Data Fetch Source For V1 Dev

If FanGraphs continues blocking automated requests, add a separate dev-only fetch path from a more accessible source, then map it into the same FanGraphs-shaped JSON contract.

Requirements:

- Output must still include the required fields listed above.
- The TypeScript importer should not need to change.
- Clearly label the source snapshot if it is not directly from FanGraphs.

This option is useful for local development but should not be treated as the final FanGraphs ingestion path.

### Option 4: Investigate `pybaseball` / FanGraphs Compatibility

Check whether the installed `pybaseball` version is using an outdated FanGraphs endpoint.

Commands:

```bash
source ingestion/.venv/bin/activate
python -m pip show pybaseball
python -m pip install --upgrade pybaseball pandas
python ingestion/fetch_fangraphs_batting.py --season 2024
```

If upgrading fixes the fetch, keep the requirements pinned to the working version in `ingestion/requirements.txt`.

Suggested improvement:

```text
pybaseball==<working-version>
pandas==<working-version>
```

### Option 5: Better Error Message And README Docs

Keep the current `HTTPError` catch, but document the fallback in `ingestion/README.md`.

Add:

- How to create the venv.
- How to install dependencies.
- How to run the automated fetch.
- What a FanGraphs 403 means.
- How to use `--csv`.
- How to import after CSV conversion.

## Recommended Next Fix

Implement Option 1 plus Option 2 with a tight scope:

- Treat manual CSV export as the supported fallback for now.
- Add explicit CSV header normalization without requiring a real CSV first.
- Preserve original CSV columns and add canonical aliases only when the canonical field is missing.
- Validate required fields before writing JSON for both manual CSV input and automated `pybaseball` output.
- Keep the TypeScript importer strict and unchanged.
- Update `ingestion/README.md` with the exact fallback workflow.

This keeps v1 moving without overengineering the ingestion layer or depending on unstable FanGraphs automation.

## Agreed Implementation Scope

Keep the current CLI shape only:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024
python ingestion/fetch_fangraphs_batting.py --season 2024 --csv ingestion/data/fangraphs-batting-2024.csv
```

Do not add batch flags such as `--start-season` or `--end-season` in this fix.

### Script Behavior

Update `ingestion/fetch_fangraphs_batting.py` to:

- Keep a required-fields list matching the TypeScript importer contract:

```text
IDfg, Name, Season, Team, G, PA, HR, R, RBI, SB, BB%, K%, AVG, OBP, SLG, OPS, wOBA, wRC+, WAR
```

- Add a small explicit header-alias map for common FanGraphs CSV variants.
- For CSV input, read the CSV, add `Season` from `--season` if missing, normalize headers, then validate required fields.
- For automated `pybaseball` output, normalize headers if needed, then validate required fields.
- Preserve all original columns from the source data.
- Add canonical alias columns only when the canonical field is missing.
- If both an alias and canonical field exist, trust the canonical field and do not overwrite it.
- Fail before writing JSON if required fields are missing.
- Include missing required fields and detected headers in the validation error.

Example validation error shape:

```text
Missing required FanGraphs fields: IDfg, wRC+. Detected headers: PlayerName, playerid, Team, ...
```

### Header Variants To Normalize

Keep normalization explicit and small. Start with the variants already identified plus obvious punctuation/case variants:

```text
PlayerName -> Name
NameASCII -> Name
playerid -> IDfg
IDfg+ -> IDfg
TeamNameAbb -> Team
BB_pct -> BB%
BB_percent -> BB%
bb_percent -> BB%
K_pct -> K%
K_percent -> K%
k_percent -> K%
wRCPlus -> wRC+
WRC+ -> wRC+
wrc_plus -> wRC+
```

Do not add fuzzy or generic stat-name transformation yet.

### Tests

Add small standalone Python tests using the standard library, not a new test framework.

Suggested command:

```bash
python -m unittest ingestion/test_fetch_fangraphs_batting.py
```

Cover:

- Alias normalization adds canonical fields.
- Original columns are preserved.
- Canonical fields are not overwritten when already present.
- Missing required fields fail with missing fields and detected headers.
- CSV flow adds `Season` before validation.

Do not wire these tests into the root `package.json` scripts in this fix.

### Documentation

Update `ingestion/README.md` to include:

- How to create and activate the Python venv.
- How to install dependencies.
- How to run the automated fetch.
- What a FanGraphs 403 means.
- How to use `--csv` for manual CSV fallback.
- How to import the generated JSON afterward.
- How to run the standalone Python tests.

### Explicit Non-Goals

Do not include these in the current fix:

- TypeScript importer changes.
- Root `package.json` script changes.
- `pybaseball` or `pandas` upgrade/pinning changes.
- Batch season import/fetch flags.
- A generic source abstraction or stat-definition system.

## Suggested Fix Checkpoints

Break the actual fix into these steps:

1. Refactor `fetch_fangraphs_batting.py`.
   Add `REQUIRED_FIELDS`, explicit header alias normalization, and required-field validation without changing the existing CLI behavior.
2. Add standalone Python tests.
   Cover alias normalization, original-column preservation, canonical-field precedence, missing-field error details, and `Season` insertion for CSV input.
3. Update `ingestion/README.md`.
   Document setup, automated fetch, FanGraphs 403 meaning, CSV fallback, generated JSON import, and the standalone test command.
4. Run verification.
   Run the Python tests:

```bash
python -m unittest ingestion/test_fetch_fangraphs_batting.py
```

Optionally run the existing database-package tests:

```bash
corepack pnpm --filter @mlb-stat-explorer/db test
```

5. Try a local conversion path if a sample CSV is available.
   Use a tiny local CSV fixture or manually downloaded FanGraphs CSV to confirm the script writes the expected JSON snapshot.

Do not split the fix further unless implementation reveals a new problem. The important separation is script behavior, tests, docs, and verification.

## Future Data Source Strategy

Manual CSV fallback is acceptable for v1, but it should not be the long-term answer for current stats or many player seasons.

### V1 Player Seasons

For the current v1 scope, one FanGraphs batting leaderboard CSV per season is enough. It should contain all v1 batting stats:

```text
G, PA, HR, R, RBI, SB, BB%, K%, AVG, OBP, SLG, OPS, wOBA, wRC+, WAR
```

This means one file per season, not one file per stat:

```text
ingestion/data/fangraphs-batting-2022.csv
ingestion/data/fangraphs-batting-2023.csv
ingestion/data/fangraphs-batting-2024.csv
```

### Historical Seasons

For importing many historical seasons, add a batch ingestion command later.

Possible shape:

```bash
python ingestion/fetch_fangraphs_batting.py --start-season 2015 --end-season 2024
corepack pnpm import:fangraphs-batting --start-season 2015 --end-season 2024
```

If automated FanGraphs fetching remains blocked, the batch flow can read local CSV snapshots from `ingestion/data` instead.

### Current Season Stats

For live or current-season stats, manual CSV downloads will not scale. Use a more reliable automated source for basic/current data and treat FanGraphs as an advanced-stat snapshot source.

Recommended long-term approach:

- Use MLB Stats API for current player/team/season basics where possible.
- Use Statcast for pitch-level, batted-ball, or event-level data if those features are added.
- Keep FanGraphs for advanced stats like `wRC+`, `wOBA`, and `WAR`, but expect automation to be flaky and support CSV snapshots.
- Store a `last_imported_at` or similar freshness timestamp so the UI can show when stats were last updated.
- Run ingestion on demand or on a schedule, not during page requests.

## Source Reliability Notes

### FanGraphs

FanGraphs is the best fit for v1 advanced batting stats, but automated access through `pybaseball` can be blocked.

Observed issue:

```text
HTTP 403 from https://www.fangraphs.com/leaders-legacy.aspx
```

Practical use:

- Good for advanced stats.
- Use manual CSV fallback when automated fetch fails.
- Do not rely on live page scraping for production behavior.

### Statcast

Statcast access through `pybaseball` is usually more automation-friendly than FanGraphs.

Tradeoffs:

- Better for pitch-by-pitch, batted-ball, and event-level data.
- Not a direct replacement for a FanGraphs season batting leaderboard.
- Season batting totals would likely need aggregation or a different endpoint.

Practical use:

- Good future source for detailed player analysis.
- Not the fastest path for v1 season-level comparison stats.

### MLB Stats API

MLB Stats API is generally a better long-term source for current/basic player and team stats.

Tradeoffs:

- More reliable for automated current stats than scraping websites.
- Good for player identity, teams, schedules, rosters, and many basic stats.
- May not include FanGraphs-specific advanced metrics such as `wRC+` or FanGraphs `WAR`.

Practical use:

- Best candidate for future current-season auto-updates.
- Pair with FanGraphs snapshots for advanced metrics.

### Baseball Reference

Baseball Reference can be scraping-sensitive and should not be the first choice for automated current updates.

Possible issues:

```text
HTTP 403
HTTP 429
temporary IP blocks or rate limits
```

Practical use:

- Add later only if Baseball Reference-specific stats are needed.
- Prefer cautious snapshot/import behavior over frequent live scraping.

## Long-Term Recommendation

Use a layered ingestion strategy:

1. MLB Stats API for reliable current player, team, and season basics.
2. FanGraphs CSV/manual snapshots for advanced batting stats in v1.
3. Statcast later for batted-ball, pitch-level, or event-level features.
4. Baseball Reference later only for source-specific stats, with careful rate limiting or manual snapshots.

This avoids blocking the app on FanGraphs automation while preserving the advanced stats that made FanGraphs useful for v1.

## Useful Commands

Start Postgres:

```bash
sudo docker compose up -d
```

Run migrations:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm db:migrate
```

Create and activate Python venv:

```bash
python3 -m venv ingestion/.venv
source ingestion/.venv/bin/activate
python -m pip install -r ingestion/requirements.txt
```

Try automated fetch:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024
```

Use CSV fallback:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024 --csv ingestion/data/fangraphs-batting-2024.csv
```

Import data:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm import:fangraphs-batting --season 2024
```

Run app:

```bash
DATABASE_URL="postgres://mlb:mlb@localhost:5433/mlb_stat_explorer" corepack pnpm dev
```
