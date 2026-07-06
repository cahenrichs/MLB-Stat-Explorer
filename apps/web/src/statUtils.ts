export type BattingStatRow = {
  playerId: number;
  fangraphsId: number;
  playerName: string;
  season: number;
  team: string | null;
  source: "fangraphs";
  games: number | null;
  plateAppearances: number | null;
  homeRuns: number | null;
  runs: number | null;
  runsBattedIn: number | null;
  stolenBases: number | null;
  walkRate: number | null;
  strikeoutRate: number | null;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  woba: number | null;
  wrcPlus: number | null;
  war: number | null;
};

export type StatFormat = "integer" | "average" | "percent" | "oneDecimal";

export type ComparisonStat = {
  key: keyof BattingStatRow;
  label: string;
  format: StatFormat;
  direction: "higher" | "lower";
};

export const comparisonStats: ComparisonStat[] = [
  { key: "games", label: "G", format: "integer", direction: "higher" },
  { key: "plateAppearances", label: "PA", format: "integer", direction: "higher" },
  { key: "homeRuns", label: "HR", format: "integer", direction: "higher" },
  { key: "runs", label: "R", format: "integer", direction: "higher" },
  { key: "runsBattedIn", label: "RBI", format: "integer", direction: "higher" },
  { key: "stolenBases", label: "SB", format: "integer", direction: "higher" },
  { key: "walkRate", label: "BB%", format: "percent", direction: "higher" },
  { key: "strikeoutRate", label: "K%", format: "percent", direction: "lower" },
  { key: "avg", label: "AVG", format: "average", direction: "higher" },
  { key: "obp", label: "OBP", format: "average", direction: "higher" },
  { key: "slg", label: "SLG", format: "average", direction: "higher" },
  { key: "ops", label: "OPS", format: "average", direction: "higher" },
  { key: "woba", label: "wOBA", format: "average", direction: "higher" },
  { key: "wrcPlus", label: "wRC+", format: "integer", direction: "higher" },
  { key: "war", label: "WAR", format: "oneDecimal", direction: "higher" }
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
  const firstValue = firstPlayer[stat.key] as number | null;
  const secondValue = secondPlayer[stat.key] as number | null;

  if (firstValue === null || secondValue === null || firstValue === secondValue) {
    return null;
  }

  if (stat.direction === "higher") {
    return firstValue > secondValue ? "first" : "second";
  }

  return firstValue < secondValue ? "first" : "second";
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
