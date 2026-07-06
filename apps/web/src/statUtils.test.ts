import assert from "node:assert/strict";
import test from "node:test";
import {
  type BattingStatRow,
  type ComparisonStat,
  formatStat,
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
  const winner = getWinner(makePlayer({ homeRuns: 58 }), makePlayer({ homeRuns: 41 }), {
    key: "homeRuns",
    label: "HR",
    format: "integer",
    direction: "higher"
  });

  assert.equal(winner, "first");
});

test("picks the lower value for lower-is-better stats", () => {
  const winner = getWinner(makePlayer({ strikeoutRate: 24.3 }), makePlayer({ strikeoutRate: 16.8 }), {
    key: "strikeoutRate",
    label: "K%",
    format: "percent",
    direction: "lower"
  });

  assert.equal(winner, "second");
});

test("does not pick a winner for ties or missing values", () => {
  const stat: ComparisonStat = {
    key: "war",
    label: "WAR",
    format: "oneDecimal",
    direction: "higher"
  };

  assert.equal(getWinner(makePlayer({ war: 6.4 }), makePlayer({ war: 6.4 }), stat), null);
  assert.equal(getWinner(makePlayer({ war: null }), makePlayer({ war: 6.4 }), stat), null);
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
    fangraphsId: 15640,
    playerName: "Aaron Judge",
    season: 2024,
    team: "NYY",
    source: "fangraphs",
    games: 158,
    plateAppearances: 704,
    homeRuns: 58,
    runs: 122,
    runsBattedIn: 144,
    stolenBases: 10,
    walkRate: 18.9,
    strikeoutRate: 24.3,
    avg: 0.322,
    obp: 0.458,
    slg: 0.701,
    ops: 1.159,
    woba: 0.476,
    wrcPlus: 218,
    war: 11.2,
    ...overrides
  };
}
