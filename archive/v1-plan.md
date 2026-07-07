# V1 Plan

## Purpose

This file is the current executable plan for v1. `BigPicture.md` remains the long-term product vision, while this file captures the narrow first version we are building now.

## V1 Goal

Build a lean end-to-end skeleton for searching and comparing two MLB player season-level batting stat lines using FanGraphs data first.

The first working path should be:

```text
FanGraphs season batting stats -> JSON file -> PostgreSQL -> Fastify API -> React search and comparison UI
```

Optimize v1 for learning and proving the full stack end to end quickly, while making a few foundation decisions that avoid obvious rewrites later.

## V1 Scope

- MLB players only.
- Season-level batting stats only.
- FanGraphs as the first data source.
- One requested season per ingestion run.
- Search-first two-player comparison within a selected season.
- Highlight the better stat value in the comparison UI.
- Use TypeScript for the app, API, database package, and import logic.
- Use Python only for fetching data from `pybaseball`.
- Use `pnpm` workspaces for the TypeScript monorepo.

## Out Of Scope For V1

- Baseball Reference ingestion.
- Comparing Baseball Reference stats against FanGraphs stats.
- Team stat pages.
- Pitching stats.
- Date ranges.
- Career totals.
- Multi-player comparison beyond two players.
- Complex charts or visualizations.
- Authentication.
- Deployment setup.
- Background workers, queues, or caching.
- Dockerizing the API or frontend.
- Full season leaderboard/table browsing.
- Visible source selector.
- Standalone player profile/detail endpoints.
- Team split rows.

## Monorepo Structure

Use a lean monorepo with separate areas for the frontend, API, database code, and ingestion.

Recommended structure:

```text
apps/
  web/
  api/
packages/
  db/
ingestion/
```

Responsibilities:

- `apps/web`: React, Vite, TypeScript frontend.
- `apps/api`: Fastify API.
- `packages/db`: Drizzle schema, database client, migrations, and TypeScript import scripts.
- `ingestion`: Python `pybaseball` fetch scripts, Python dependencies, and generated data files.

Use Docker Compose for local PostgreSQL only.

## Data Source Strategy

Start with FanGraphs batting season stats.

Do not ingest Baseball Reference data until the full FanGraphs skeleton is working end to end.

The first milestone should be:

```text
FanGraphs season batting stats -> PostgreSQL -> Fastify endpoint -> React player search
```

The second milestone can add Baseball Reference ingestion and source comparison once the skeleton is stable.

## Ingestion Flow

Use a two-step ingestion flow for v1.

Step 1: Python fetches FanGraphs batting stats through `pybaseball` and writes a local JSON file.

Example:

```bash
python ingestion/fetch_fangraphs_batting.py --season 2024
```

Output example:

```text
ingestion/data/fangraphs-batting-2024.json
```

Python should stay close to the source output and should not rename FanGraphs columns to internal app names. It can perform practical JSON serialization cleanup, such as converting invalid JSON values to `null`.

Python dependencies should use `ingestion/requirements.txt` with a local `.venv`. Do not commit `.venv`.

Step 2: A TypeScript import script reads the JSON file and writes to PostgreSQL using Drizzle.

Example:

```bash
pnpm import:fangraphs-batting --season 2024
```

Reasons for this approach:

- Python stays focused on fetching/parsing source data.
- TypeScript and Drizzle own database writes.
- JSON snapshots are inspectable and useful for debugging.
- The import step can be tested without calling `pybaseball`.

## Ingestion Requirements

- The Python fetch script should accept a `--season` argument.
- The import script should import one season per run.
- Imports should be idempotent.
- Re-running the same season should update existing rows rather than duplicate them.
- Player records should be created when missing.
- Player names may be updated during import if the source data changes.
- For v1, import only one total row per player-season.
- Ignore/defer team split rows.
- If the source output contains multiple rows for the same player-season and the importer cannot clearly identify the total row, fail with a clear error rather than importing ambiguous data.

Recommended uniqueness rule for stat rows:

```text
source + season + player_id
```

The importer should use `fangraphsId` to find or create the internal player, then upsert the stat row by `source + season + playerId`.

## Database Strategy

Use a hybrid schema for v1.

Normalize core identity fields, store commonly used comparison stats as typed columns, and preserve the original FanGraphs row in a `raw` JSONB column.

This gives us easy querying now while preserving source data for debugging and future migrations.

Possible future direction: remove `raw` once the source model and required fields are stable.

## Player Identity

Use an internal player ID as the app/database primary key.

Also store `fangraphs_id` as the first external identifier.

Recommended player fields for v1:

- `id`
- `fangraphsId`
- `name`

Future external IDs can be added later, such as:

- `mlbamId`
- `bbrefId`

Do not use `fangraphs_id` as the internal primary key because future sources will need identity matching.

For v1, trust `fangraphsId` as the only reliable external identity. Do not attempt cross-source identity matching until another source is added.

## Initial Tables

Start with a small schema.

Recommended tables:

- `players`
- `player_batting_season_stats`

Do not create a `stat_sources` table in v1. Use a constrained `source` column on stat rows and default it to `fangraphs` where appropriate.

The batting stats table should include:

- `playerId`
- `season`
- `team`
- `source`
- `games`
- `plateAppearances`
- `homeRuns`
- `runs`
- `runsBattedIn`
- `stolenBases`
- `walkRate`
- `strikeoutRate`
- `avg`
- `obp`
- `slg`
- `ops`
- `woba`
- `wrcPlus`
- `war`
- `raw`

Treat `team` as a nullable display field for v1. It should not be part of stat row identity.

Use integer columns for counting stats:

- `games`
- `plateAppearances`
- `homeRuns`
- `runs`
- `runsBattedIn`
- `stolenBases`
- `wrcPlus`

Use PostgreSQL numeric/decimal-style columns for precision stats:

- `walkRate`
- `strikeoutRate`
- `avg`
- `obp`
- `slg`
- `ops`
- `woba`
- `war`

Store percent stats as display percent values. For example, `8.5%` should be stored as `8.5`, not `0.085`.

## Naming Strategy

Use code-friendly names internally and baseball-style labels in the UI.

Internal examples:

- `homeRuns`
- `runsBattedIn`
- `walkRate`
- `strikeoutRate`
- `wrcPlus`
- `war`
- `avg`
- `obp`
- `slg`
- `ops`
- `woba`

UI label examples:

- `HR`
- `RBI`
- `BB%`
- `K%`
- `wRC+`
- `WAR`
- `AVG`
- `OBP`
- `SLG`
- `OPS`
- `wOBA`

## Import Validation

Fail fast when required columns are missing.

Required FanGraphs fields for v1:

- FanGraphs player ID
- Player name
- Season
- Team
- `G`
- `PA`
- `HR`
- `R`
- `RBI`
- `SB`
- `BB%`
- `K%`
- `AVG`
- `OBP`
- `SLG`
- `OPS`
- `wOBA`
- `wRC+`
- `WAR`

Validation behavior:

- Missing required columns should stop the import with a clear error.
- Unmapped source columns should be preserved in `raw`.
- Blank or invalid stat values should be stored as `null` when possible.
- Identity fields like player ID, player name, and season should not be nullable during import.
- Missing or invalid identity fields should fail the whole import.
- Duplicate player-season rows without a clear total row should fail the whole import.

Use a straightforward hard-coded FanGraphs mapping in TypeScript for v1. Do not create a generic stat-definition system yet.

## API Plan

Start with one general stats endpoint plus one seasons endpoint.

Initial endpoint:

```text
GET /batting-stats?season=2024&source=fangraphs
```

Likely query params:

- `season`
- `source`
- `playerName`
- `team`
- `limit`
- `sort`
- `order`

Additional endpoint:

```text
GET /seasons?source=fangraphs
```

The seasons endpoint should return the distinct imported seasons for the selected source, such as:

```json
[2024, 2023]
```

API behavior:

- `season` is required for `GET /batting-stats`.
- `source` defaults to `fangraphs`.
- `playerName` is optional in the API so the endpoint can support a future full table view.
- The v1 frontend should require search text before calling `GET /batting-stats`.
- `limit` defaults to `25` and has a max of `100`.
- Apply filters before applying `limit`.
- Search results should sort by player name.
- Decimal/numeric database values should be returned as numbers from the API, not strings.
- Do not return `raw` in normal API responses.
- Keep allowed filter/sort fields whitelisted; do not pass arbitrary query strings into SQL.

Keep two-player comparison logic in the frontend for v1.

Do not create a comparison-specific API endpoint until the UI and data needs are clearer.

Do not create standalone player endpoints in v1.

## Frontend Plan

Build a search-first player comparison interface. Defer full season table browsing to a later version.

Initial screen behavior:

- Season selector at the top.
- Source defaults to FanGraphs, but do not show a source selector in v1.
- Search input for player name.
- Search should require at least 2 characters.
- Search should be debounced, around 300 ms.
- Empty search should show an instructional empty state.
- One-character search should tell the user to type at least 2 characters.
- Use TanStack Query for API data fetching.
- Use a custom HTML table/list for search results.
- Do not use TanStack Table in v1.
- Do not add visible sortable table columns in v1.
- Ability to select exactly two players.
- Selected players should remain selected when search text changes.
- Block selecting a third player until one selected player is removed.
- Selected players should be removable by clicking a selected result row or by using an `x` button in the selected player area.
- Show a selected players area after the first player is selected.
- Preserve comparison order based on selection order.
- Clear selected players when the season changes.
- Show a comparison panel once two players are selected.
- Display selected players side by side.
- Highlight the better value for each comparable stat.
- Reflect season and search state in the URL query string. Do not persist selected players in the URL for v1.

## Comparison Rules

Use a simple fixed rule per stat column.

Higher is better:

- `G`
- `PA`
- `AVG`
- `OBP`
- `SLG`
- `OPS`
- `wOBA`
- `wRC+`
- `WAR`
- `HR`
- `R`
- `RBI`
- `SB`
- `BB%`

Lower is better:

- `K%`

Neutral or no highlight:

- `AB`
- `Age`
- Player identifiers
- Team identifiers

UI behavior:

- If Player A has the better value, highlight Player A's cell.
- If Player B has the better value, highlight Player B's cell.
- If values are tied, highlight neither.
- If either value is missing, do not highlight that stat.

Use one curated flat comparison stat list for v1:

- `G`
- `PA`
- `HR`
- `R`
- `RBI`
- `SB`
- `BB%`
- `K%`
- `AVG`
- `OBP`
- `SLG`
- `OPS`
- `wOBA`
- `wRC+`
- `WAR`

Do not show calculated stat differences in v1. Only highlight the better value.

Frontend formatting rules:

- `AVG`, `OBP`, `SLG`, `OPS`, and `wOBA`: display like `.312`.
- `BB%` and `K%`: display like `8.5%`.
- `WAR`: display like `6.4`.
- `wRC+` and counting stats: display as whole numbers.
- Missing/null values: display as `-`.

## Testing Plan

Keep v1 tests focused on risky seams rather than full end-to-end coverage.

Recommended tests:

- Import mapping test: sample FanGraphs row maps to internal names correctly.
- Import upsert test: rerunning the same player and season updates instead of duplicating.
- API route test: `GET /batting-stats?season=2024&playerName=judge` returns expected rows.
- Frontend stat-rule test: better-stat highlighting works for higher-better and lower-better stats.
- Frontend formatting test: baseball stat formatting works for decimals, percentages, integers, and missing values.

Avoid full browser end-to-end tests until the UI stabilizes.

Add focused tests when each risky seam is introduced rather than postponing all tests until the end. For v1 frontend tests, prefer pure utility tests over React component rendering tests.

## Implementation Order

1. Create the monorepo/package skeleton.
2. Add local PostgreSQL with Docker Compose.
3. Add Drizzle schema and initial migrations.
4. Add the FanGraphs Python fetch script with `--season`.
5. Add the TypeScript import script with validation and upserts.
6. Add the Fastify API with `GET /batting-stats` and `GET /seasons`.
7. Add the React/Vite frontend search-first UI.
8. Add two-player selection and comparison highlighting.
9. Add focused tests alongside import mapping, upsert behavior, API route behavior, stat formatting, and stat highlighting.

## Implementation Slices

Use these slices when asking an agent to implement the plan. Each slice should be small enough to build, verify, and review before moving to the next one.

### Slice 1: Repo Skeleton

- Create the `pnpm` workspace.
- Create `apps/web`, `apps/api`, `packages/db`, and `ingestion`.
- Add shared TypeScript/package baseline where needed.
- Verify workspace install/scripts are wired correctly.

### Slice 2: Database Foundation

- Add Docker Compose for local PostgreSQL only.
- Add Drizzle schema in `packages/db`.
- Add the database client and migration setup.
- Add initial migrations for `players` and `player_batting_season_stats`.
- Verify the database can start and migrations can run.

### Slice 3: Ingestion

- Add `ingestion/requirements.txt` and the Python FanGraphs fetch script.
- Fetch one season into `ingestion/data/fangraphs-batting-<season>.json`.
- Add the TypeScript FanGraphs import script in `packages/db`.
- Add validation, mapping, total-row handling, and idempotent upserts.
- Add focused import mapping and upsert tests.

### Slice 4: API

- Add the Fastify app in `apps/api`.
- Add `GET /batting-stats` with required `season`, optional `playerName`, default `source=fangraphs`, default `limit=25`, and max `limit=100`.
- Add `GET /seasons`.
- Return numeric stat values as numbers and omit `raw`.
- Add focused route tests.

### Slice 5: Frontend

- Add the React/Vite app in `apps/web`.
- Add TanStack Query.
- Add season selection and debounced 2-character player search.
- Add the custom search results table/list.
- Add selected-player cards with `x` removal.
- Enforce max-two selection and clear selection on season change.
- Add the comparison panel with winner highlighting.

### Slice 6: Frontend Utilities And Polish

- Add pure utility tests for stat formatting, stat highlighting, and selection rules.
- Polish loading, empty, no-results, and error states.
- Reflect season and search state in the URL query string.
- Verify the full v1 flow manually from fetch to comparison UI.

## Current Decision Summary

- V1 is season-level player batting stat comparison.
- Start with FanGraphs only.
- Use one season per ingestion run.
- Use Python to fetch JSON and TypeScript/Drizzle to import into PostgreSQL.
- Use internal player IDs plus `fangraphsId`.
- Use typed stat columns plus `raw` JSONB.
- Do not create a `stat_sources` table in v1.
- Use a general stats API endpoint first.
- Include `GET /seasons`.
- V1 UI is search-first, not full table-first.
- Keep comparison highlighting in the frontend.
- Highlight better stat cells instead of showing calculated difference rows.
- Keep tests focused and lightweight.
- Use `pnpm` workspaces for TypeScript packages.
- Use Docker Compose for PostgreSQL only.
