import assert from "node:assert/strict";
import test from "node:test";
import {
  type BattingStatRow,
  type ComparisonStat,
  formatStat,
  getStatValue,
  getWinner,
  toggleSelectedPlayer
} from "./statUtils.js";

test("formats baseball stats for display", () => {
  assert.equal(formatStat(null, "integer"), "-");
  assert.equal(formatStat(58, "integer"), "58");
  assert.equal(formatStat(0.312, "average"), ".312");
  assert.equal(formatStat(8.5, "percent"), "8.5%");
  assert.equal(formatStat(6.36, "oneDecimal"), "6.4");
});

test("picks the higher value for higher-is-better stats", () => {
  const winner = getWinner(makePlayer(), makePlayer({ standard: standardStats({ homeRuns: 41 }) }), {
    key: "homeRuns",
    label: "HR",
    source: "mlb",
    format: "integer",
    direction: "higher"
  });

  assert.equal(winner, "first");
});

test("picks the lower value for lower-is-better stats", () => {
  const winner = getWinner(makePlayer(), makePlayer({ standard: standardStats({ homeRuns: 41 }) }), {
    key: "homeRuns",
    label: "HR",
    source: "mlb",
    format: "integer",
    direction: "lower"
  });

  assert.equal(winner, "second");
});

test("does not pick a winner for ties or missing values", () => {
  const stat: ComparisonStat = {
    key: "war",
    label: "WAR",
    source: "fangraphs",
    format: "oneDecimal",
    direction: "higher"
  };

  assert.equal(getWinner(makePlayer({ advanced: { source: "fangraphs", available: true, importedAt: "2026-07-14T12:05:00.000Z", stats: { woba: 0.4, wrcPlus: 150, war: 6.4 } } }), makePlayer({ advanced: { source: "fangraphs", available: true, importedAt: "2026-07-14T12:05:00.000Z", stats: { woba: 0.4, wrcPlus: 150, war: 6.4 } } }), stat), null);
  assert.equal(getWinner(makePlayer({ advanced: { source: "fangraphs", available: false, importedAt: null, stats: null } }), makePlayer(), stat), null);
});

test("reads standard and advanced values from their labeled sources", () => {
  const player = makePlayer();

  assert.equal(getStatValue(player, { key: "homeRuns", label: "HR", source: "mlb", format: "integer", direction: "higher" }), 58);
  assert.equal(getStatValue(player, { key: "war", label: "WAR", source: "fangraphs", format: "oneDecimal", direction: "higher" }), 11.2);
  assert.equal(getStatValue(makePlayer({ advanced: { source: "fangraphs", available: false, importedAt: null, stats: null } }), { key: "war", label: "WAR", source: "fangraphs", format: "oneDecimal", direction: "higher" }), null);
});

test("toggles selected players while preserving max-two selection order", () => {
  const first = makePlayer({ playerId: 1, playerName: "Aaron Judge" });
  const second = makePlayer({ playerId: 2, playerName: "Juan Soto" });
  const third = makePlayer({ playerId: 3, playerName: "Shohei Ohtani" });

  assert.deepEqual(toggleSelectedPlayer([], first), [first]);
  assert.deepEqual(toggleSelectedPlayer([first], second), [first, second]);
  assert.deepEqual(toggleSelectedPlayer([first, second], third), [first, second]);
  assert.deepEqual(toggleSelectedPlayer([first, second], first), [second]);
});

function makePlayer(overrides: Partial<BattingStatRow> = {}): BattingStatRow {
  return {
    playerId: 1,
    mlbamId: 592450,
    playerName: "Aaron Judge",
    season: 2024,
    standard: {
      source: "mlb",
      importedAt: "2026-07-14T12:00:00.000Z",
      stats: {
        games: 158,
        plateAppearances: 704,
        homeRuns: 58,
        runs: 122,
        runsBattedIn: 144,
        stolenBases: 10,
        avg: 0.322,
        obp: 0.458,
        slg: 0.701,
        ops: 1.159
      }
    },
    advanced: {
      source: "fangraphs",
      available: true,
      importedAt: "2026-07-14T12:05:00.000Z",
      stats: { woba: 0.476, wrcPlus: 218, war: 11.2 }
    },
    teamSplits: [],
    ...overrides
  };
}

function standardStats(overrides: Partial<BattingStatRow["standard"]["stats"]>): BattingStatRow["standard"] {
  return {
    source: "mlb",
    importedAt: "2026-07-14T12:00:00.000Z",
    stats: {
      games: 158,
      plateAppearances: 704,
      homeRuns: 58,
      runs: 122,
      runsBattedIn: 144,
      stolenBases: 10,
      avg: 0.322,
      obp: 0.458,
      slg: 0.701,
      ops: 1.159,
      ...overrides
    }
  };
}
