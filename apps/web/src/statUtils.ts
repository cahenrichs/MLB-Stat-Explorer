export type StandardStats = {
  games: number | null;
  plateAppearances: number | null;
  homeRuns: number | null;
  runs: number | null;
  runsBattedIn: number | null;
  stolenBases: number | null;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
};

export type AdvancedStats = {
  woba: number | null;
  wrcPlus: number | null;
  war: number | null;
};

export type BattingStatRow = {
  playerId: number;
  mlbamId: number;
  playerName: string;
  season: number;
  standard: {
    source: "mlb";
    importedAt: string;
    stats: StandardStats;
  };
  advanced: {
    source: "fangraphs";
    available: boolean;
    importedAt: string | null;
    stats: AdvancedStats | null;
  };
  teamSplits: Array<{
    team: string | null;
    standard: {
      source: "mlb";
      importedAt: string;
      stats: StandardStats;
    };
  }>;
};

export type StatFormat = "integer" | "average" | "percent" | "oneDecimal";

export type ComparisonStat = {
  key: keyof StandardStats | keyof AdvancedStats;
  label: string;
  source: "mlb" | "fangraphs";
  format: StatFormat;
  direction: "higher" | "lower";
};

export const comparisonStats: ComparisonStat[] = [
  { key: "games", label: "G", source: "mlb", format: "integer", direction: "higher" },
  { key: "plateAppearances", label: "PA", source: "mlb", format: "integer", direction: "higher" },
  { key: "homeRuns", label: "HR", source: "mlb", format: "integer", direction: "higher" },
  { key: "runs", label: "R", source: "mlb", format: "integer", direction: "higher" },
  { key: "runsBattedIn", label: "RBI", source: "mlb", format: "integer", direction: "higher" },
  { key: "stolenBases", label: "SB", source: "mlb", format: "integer", direction: "higher" },
  { key: "avg", label: "AVG", source: "mlb", format: "average", direction: "higher" },
  { key: "obp", label: "OBP", source: "mlb", format: "average", direction: "higher" },
  { key: "slg", label: "SLG", source: "mlb", format: "average", direction: "higher" },
  { key: "ops", label: "OPS", source: "mlb", format: "average", direction: "higher" },
  { key: "woba", label: "wOBA", source: "fangraphs", format: "average", direction: "higher" },
  { key: "wrcPlus", label: "wRC+", source: "fangraphs", format: "integer", direction: "higher" },
  { key: "war", label: "WAR", source: "fangraphs", format: "oneDecimal", direction: "higher" }
];

export function toggleSelectedPlayer(currentPlayers: BattingStatRow[], player: BattingStatRow) {
  const isSelected = currentPlayers.some((selected) => selected.playerId === player.playerId);

  if (isSelected) {
    return currentPlayers.filter((selected) => selected.playerId !== player.playerId);
  }

  if (currentPlayers.length >= 2) {
    return currentPlayers;
  }

  return [...currentPlayers, player];
}

export function getWinner(firstPlayer: BattingStatRow, secondPlayer: BattingStatRow, stat: ComparisonStat) {
  const firstValue = getStatValue(firstPlayer, stat);
  const secondValue = getStatValue(secondPlayer, stat);

  if (firstValue === null || secondValue === null || firstValue === secondValue) {
    return null;
  }

  if (stat.direction === "higher") {
    return firstValue > secondValue ? "first" : "second";
  }

  return firstValue < secondValue ? "first" : "second";
}

export function getStatValue(player: BattingStatRow, stat: ComparisonStat) {
  if (stat.source === "mlb") {
    return player.standard.stats[stat.key as keyof StandardStats];
  }

  return player.advanced.stats?.[stat.key as keyof AdvancedStats] ?? null;
}

export function formatStat(value: number | null, format: StatFormat) {
  if (value === null) {
    return "-";
  }

  if (format === "integer") {
    return Math.round(value).toString();
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  if (format === "oneDecimal") {
    return value.toFixed(1);
  }

  return value.toFixed(3).replace(/^0/, "");
}
