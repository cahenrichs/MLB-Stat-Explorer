import assert from "node:assert/strict";
import test from "node:test";
import {
  importFangraphsBattingRows,
  mapFangraphsBattingRow,
  selectTotalRows,
  type FangraphsBattingRepository,
  type FangraphsBattingRow
} from "./fangraphsBatting.js";

const baseRawRow = {
  IDfg: 15640,
  Name: "Aaron Judge",
  Season: 2024,
  Team: "NYY",
  G: 158,
  PA: 704,
  HR: 58,
  R: 122,
  RBI: 144,
  SB: 10,
  "BB%": "18.9%",
  "K%": "24.3%",
  AVG: ".322",
  OBP: ".458",
  SLG: ".701",
  OPS: "1.159",
  wOBA: ".476",
  "wRC+": 218,
  WAR: "11.2",
  ExtraColumn: "preserved"
};

test("maps a FanGraphs row to internal names", () => {
  const mapped = mapFangraphsBattingRow(baseRawRow);

  assert.equal(mapped.fangraphsId, 15640);
  assert.equal(mapped.name, "Aaron Judge");
  assert.equal(mapped.season, 2024);
  assert.equal(mapped.team, "NYY");
  assert.equal(mapped.plateAppearances, 704);
  assert.equal(mapped.homeRuns, 58);
  assert.equal(mapped.walkRate, "18.9");
  assert.equal(mapped.strikeoutRate, "24.3");
  assert.equal(mapped.avg, ".322");
  assert.equal(mapped.wrcPlus, 218);
  assert.equal(mapped.raw.ExtraColumn, "preserved");
});

test("maps blank nullable stat values to null", () => {
  const mapped = mapFangraphsBattingRow({
    ...baseRawRow,
    HR: "",
    "BB%": null,
    WAR: undefined
  });

  assert.equal(mapped.homeRuns, null);
  assert.equal(mapped.walkRate, null);
  assert.equal(mapped.war, null);
});

test("fails when required fields are missing", async () => {
  await assert.rejects(
    () => importFangraphsBattingRows([{ ...baseRawRow, IDfg: undefined }], createMemoryRepository()),
    /Invalid required integer field: IDfg/
  );

  const { IDfg: _IDfg, ...missingIdRow } = baseRawRow;
  await assert.rejects(
    () => importFangraphsBattingRows([missingIdRow], createMemoryRepository()),
    /missing required field: IDfg/
  );
});

test("selects a clear total row for duplicate player seasons", () => {
  const rows = [
    mapFangraphsBattingRow({ ...baseRawRow, Team: "NYY", HR: 10 }),
    mapFangraphsBattingRow({ ...baseRawRow, Team: "TOT", HR: 25 })
  ];

  const selected = selectTotalRows(rows);

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.team, "TOT");
  assert.equal(selected[0]?.homeRuns, 25);
});

test("fails ambiguous duplicate player seasons", () => {
  const rows = [
    mapFangraphsBattingRow({ ...baseRawRow, Team: "NYY" }),
    mapFangraphsBattingRow({ ...baseRawRow, Team: "SFG" })
  ];

  assert.throws(() => selectTotalRows(rows), /Ambiguous FanGraphs rows/);
});

test("imports rows through repository upserts", async () => {
  const repository = createMemoryRepository();

  const first = await importFangraphsBattingRows([baseRawRow], repository);
  const second = await importFangraphsBattingRows(
    [{ ...baseRawRow, Name: "Aaron Judge Updated", HR: 59 }],
    repository
  );

  assert.deepEqual(first, { imported: 1 });
  assert.deepEqual(second, { imported: 1 });
  assert.equal(repository.players.size, 1);
  assert.equal(repository.stats.size, 1);
  assert.equal(repository.players.get(15640)?.name, "Aaron Judge Updated");
  assert.equal(repository.stats.get("fangraphs:2024:1")?.homeRuns, 59);
});

function createMemoryRepository() {
  const players = new Map<number, { id: number; fangraphsId: number; name: string }>();
  const stats = new Map<string, FangraphsBattingRow & { playerId: number }>();
  let nextPlayerId = 1;

  const repository: FangraphsBattingRepository & {
    players: typeof players;
    stats: typeof stats;
  } = {
    players,
    stats,
    async upsertPlayer(input) {
      const existing = players.get(input.fangraphsId);

      if (existing) {
        existing.name = input.name;
        return { id: existing.id };
      }

      const player = {
        id: nextPlayerId,
        fangraphsId: input.fangraphsId,
        name: input.name
      };
      nextPlayerId += 1;
      players.set(input.fangraphsId, player);

      return { id: player.id };
    },
    async upsertBattingStat(input) {
      stats.set(`fangraphs:${input.season}:${input.playerId}`, input);
    }
  };

  return repository;
}
