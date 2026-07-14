import type { BattingRepository, UpsertFangraphsAdvancedStatInput } from "../battingRepository.js";
import { createBattingRepository } from "../battingRepository.js";

type ImportOptions = {
  season: number;
  csv: string;
  repository?: BattingRepository;
};

type ParsedRow = {
  rowNumber: number;
  mlbamId: number;
  stat: Omit<UpsertFangraphsAdvancedStatInput, "playerId">;
};

const FIELD_ALIASES = {
  mlbamId: ["mlbam id", "mlbamid", "mlbam_id"],
  season: ["season", "year"],
  woba: ["woba"],
  wrcPlus: ["wrc+", "wrc plus"],
  war: ["war", "fwar"]
} as const;

export async function importFangraphsAdvancedCsv({
  season,
  csv,
  repository = createBattingRepository()
}: ImportOptions): Promise<{ players: number }> {
  if (!Number.isInteger(season) || season < 2024) {
    throw new Error("Season must be an integer from 2024 onward");
  }

  const rows = parseCsv(csv);
  const headers = resolveHeaders(rows.shift() ?? []);
  const importedAt = new Date();
  const errors: string[] = [];
  const seenIds = new Set<number>();
  const parsedRows: ParsedRow[] = [];

  rows.forEach((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== headers.columns) {
      errors.push(`Row ${rowNumber}: expected ${headers.columns} columns, found ${values.length}`);
      return;
    }

    const raw = Object.fromEntries(headers.original.map((header, column) => [header, values[column] ?? ""]));
    const rowErrors: string[] = [];
    const mlbamId = parsePositiveInteger(valueFor(values, headers.mlbamId), "MLBAM ID", rowErrors);
    const sourceSeason = parsePositiveInteger(valueFor(values, headers.season), "season", rowErrors);
    const woba = parseDecimal(valueFor(values, headers.woba), "wOBA", 3, false, rowErrors);
    const wrcPlus = parsePositiveInteger(valueFor(values, headers.wrcPlus), "wRC+", rowErrors, true);
    const war = parseDecimal(valueFor(values, headers.war), "WAR", 1, true, rowErrors);

    if (sourceSeason !== null && sourceSeason !== season) {
      rowErrors.push(`season must be ${season}`);
    }
    if (woba !== null && (Number(woba) < 0 || Number(woba) > 1)) {
      rowErrors.push("wOBA must be between 0 and 1");
    }
    if (mlbamId !== null && seenIds.has(mlbamId)) {
      rowErrors.push(`duplicate MLBAM ID ${mlbamId}`);
    }
    if (mlbamId !== null) {
      seenIds.add(mlbamId);
    }
    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}`);
      return;
    }

    parsedRows.push({
      rowNumber,
      mlbamId: mlbamId!,
      stat: { season, sourceSeason: sourceSeason!, woba, wrcPlus, war, raw, importedAt }
    });
  });

  if (parsedRows.length === 0 && errors.length === 0) {
    errors.push("CSV contains no data rows");
  }

  const players = await Promise.all(
    parsedRows.map(async (row) => ({ row, player: await repository.findPlayerByMlbamId(row.mlbamId) }))
  );
  for (const { row, player } of players) {
    if (!player) {
      errors.push(`Row ${row.rowNumber}: MLBAM ID ${row.mlbamId} is not known to the MLB import`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`FanGraphs CSV import failed:\n${errors.join("\n")}`);
  }

  await repository.transaction(async (transaction) => {
    for (const { row, player } of players) {
      await transaction.upsertFangraphsAdvancedStat({ ...row.stat, playerId: player!.id });
    }
  });

  return { players: parsedRows.length };
}

function resolveHeaders(original: string[]) {
  if (original.length === 0) {
    throw new Error("FanGraphs CSV import failed: CSV is empty");
  }
  const normalized = original.map(normalizeHeader);
  const result = { original, columns: original.length } as Record<string, number | string[] | undefined>;
  const missing: string[] = [];

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const matches = normalized
      .map((header, index) => (aliases.includes(header as never) ? index : -1))
      .filter((index) => index !== -1);
    if (matches.length === 0) {
      missing.push(field);
    } else if (matches.length > 1) {
      throw new Error(`FanGraphs CSV import failed: multiple headers match ${field}`);
    } else {
      result[field] = matches[0];
    }
  }
  if (missing.length > 0) {
    throw new Error(`FanGraphs CSV import failed: missing required headers: ${missing.join(", ")}`);
  }
  return result as {
    original: string[];
    columns: number;
    mlbamId: number;
    season: number;
    woba: number;
    wrcPlus: number;
    war: number;
  };
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[ _-]+/g, " ");
}

function valueFor(values: string[], column: number): string {
  return values[column]?.trim() ?? "";
}

function parsePositiveInteger(
  value: string,
  field: string,
  errors: string[],
  allowZero = false
): number | null {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    errors.push(`${field} is invalid`);
    return null;
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1)) {
    errors.push(`${field} is invalid`);
    return null;
  }
  return result;
}

function parseDecimal(
  value: string,
  field: string,
  scale: number,
  signed: boolean,
  errors: string[]
): string | null {
  const expression = signed ? /^-?(?:\d+|\d*\.\d+)$/ : /^(?:\d+|\d*\.\d+)$/;
  if (!expression.test(value) || !Number.isFinite(Number(value))) {
    errors.push(`${field} is invalid`);
    return null;
  }
  if ((value.split(".")[1]?.length ?? 0) > scale) {
    errors.push(`${field} supports at most ${scale} decimal places`);
    return null;
  }
  return value;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) {
    throw new Error("FanGraphs CSV import failed: unterminated quoted value");
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.length > 0));
}
