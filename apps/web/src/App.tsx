import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type BattingStatRow = {
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

type ComparisonStat = {
  key: keyof BattingStatRow;
  label: string;
  format: "integer" | "average" | "percent" | "oneDecimal";
  direction: "higher" | "lower";
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

const comparisonStats: ComparisonStat[] = [
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

export function App() {
  const [season, setSeason] = useState<number | undefined>();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<BattingStatRow[]>([]);

  const seasonsQuery = useQuery({
    queryKey: ["seasons"],
    queryFn: fetchSeasons
  });

  useEffect(() => {
    if (season === undefined && seasonsQuery.data && seasonsQuery.data.length > 0) {
      setSeason(seasonsQuery.data[0]);
    }
  }, [season, seasonsQuery.data]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const canSearch = season !== undefined && debouncedSearchText.length >= 2;

  const battingStatsQuery = useQuery({
    queryKey: ["batting-stats", season, debouncedSearchText],
    queryFn: () => fetchBattingStats(season as number, debouncedSearchText),
    enabled: canSearch
  });

  function handleSeasonChange(nextSeason: number) {
    setSeason(nextSeason);
    setSelectedPlayers([]);
  }

  function toggleSelectedPlayer(player: BattingStatRow) {
    const isSelected = selectedPlayers.some((selected) => selected.playerId === player.playerId);

    if (isSelected) {
      setSelectedPlayers((current) => current.filter((selected) => selected.playerId !== player.playerId));
      return;
    }

    if (selectedPlayers.length >= 2) {
      return;
    }

    setSelectedPlayers((current) => [...current, player]);
  }

  function removeSelectedPlayer(playerId: number) {
    setSelectedPlayers((current) => current.filter((selected) => selected.playerId !== playerId));
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">FanGraphs season batting</p>
          <h1>MLB Stat Explorer</h1>
          <p className="hero-copy">
            Search a season, pick two hitters, and compare their production side by side.
          </p>
        </div>

        <label className="season-control">
          <span>Season</span>
          <select
            value={season ?? ""}
            disabled={seasonsQuery.isLoading || seasonsQuery.isError || !seasonsQuery.data?.length}
            onChange={(event) => handleSeasonChange(Number(event.target.value))}
          >
            {seasonsQuery.data?.map((availableSeason) => (
              <option key={availableSeason} value={availableSeason}>
                {availableSeason}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="search-panel">
        <label className="search-control">
          <span>Player search</span>
          <input
            value={searchText}
            placeholder="Type at least 2 characters, for example Judge"
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>

        <SelectedPlayers players={selectedPlayers} onRemove={removeSelectedPlayer} />

        <SearchResults
          searchText={searchText}
          rows={battingStatsQuery.data ?? []}
          isLoading={battingStatsQuery.isFetching}
          isError={battingStatsQuery.isError}
          selectedPlayers={selectedPlayers}
          onTogglePlayer={toggleSelectedPlayer}
        />
      </section>

      {selectedPlayers.length === 2 ? (
        <ComparisonPanel firstPlayer={selectedPlayers[0]!} secondPlayer={selectedPlayers[1]!} />
      ) : null}
    </main>
  );
}

function SelectedPlayers({
  players,
  onRemove
}: {
  players: BattingStatRow[];
  onRemove: (playerId: number) => void;
}) {
  if (players.length === 0) {
    return null;
  }

  return (
    <section className="selected-panel" aria-label="Selected players">
      <div className="selected-heading">
        <h2>Selected Players</h2>
        <span>{players.length}/2</span>
      </div>

      <div className="selected-grid">
        {players.map((player) => (
          <article key={player.playerId} className="selected-card">
            <div>
              <strong>{player.playerName}</strong>
              <span>
                {player.team ?? "No team"} - {player.season}
              </span>
            </div>
            <button type="button" onClick={() => onRemove(player.playerId)} aria-label={`Remove ${player.playerName}`}>
              x
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchResults({
  searchText,
  rows,
  isLoading,
  isError,
  selectedPlayers,
  onTogglePlayer
}: {
  searchText: string;
  rows: BattingStatRow[];
  isLoading: boolean;
  isError: boolean;
  selectedPlayers: BattingStatRow[];
  onTogglePlayer: (player: BattingStatRow) => void;
}) {
  const trimmedSearch = searchText.trim();

  if (trimmedSearch.length === 0) {
    return <p className="state-message">Start by searching for a player name.</p>;
  }

  if (trimmedSearch.length === 1) {
    return <p className="state-message">Type at least 2 characters to search.</p>;
  }

  if (isLoading) {
    return <p className="state-message">Searching players...</p>;
  }

  if (isError) {
    return <p className="state-message error">Could not load player results.</p>;
  }

  if (rows.length === 0) {
    return <p className="state-message">No players found for that search.</p>;
  }

  return (
    <div className="results-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th>G</th>
            <th>HR</th>
            <th>OPS</th>
            <th>WAR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selectedPlayers.some((player) => player.playerId === row.playerId);
            const isDisabled = !isSelected && selectedPlayers.length >= 2;

            return (
              <tr
                key={row.playerId}
                className={isSelected ? "is-selected" : undefined}
                aria-disabled={isDisabled}
                onClick={() => onTogglePlayer(row)}
              >
                <td>
                  <button type="button" disabled={isDisabled}>
                    {row.playerName}
                  </button>
                </td>
                <td>{row.team ?? "-"}</td>
                <td>{formatStat(row.games, "integer")}</td>
                <td>{formatStat(row.homeRuns, "integer")}</td>
                <td>{formatStat(row.ops, "average")}</td>
                <td>{formatStat(row.war, "oneDecimal")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonPanel({
  firstPlayer,
  secondPlayer
}: {
  firstPlayer: BattingStatRow;
  secondPlayer: BattingStatRow;
}) {
  return (
    <section className="comparison-panel">
      <div className="comparison-header">
        <div>
          <p className="eyebrow">Comparison</p>
          <h2>
            {firstPlayer.playerName} vs. {secondPlayer.playerName}
          </h2>
        </div>
      </div>

      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Stat</th>
              <th>{firstPlayer.playerName}</th>
              <th>{secondPlayer.playerName}</th>
            </tr>
          </thead>
          <tbody>
            {comparisonStats.map((stat) => {
              const winner = getWinner(firstPlayer, secondPlayer, stat);

              return (
                <tr key={stat.key}>
                  <th>{stat.label}</th>
                  <td className={winner === "first" ? "winner" : undefined}>
                    {formatStat(firstPlayer[stat.key] as number | null, stat.format)}
                  </td>
                  <td className={winner === "second" ? "winner" : undefined}>
                    {formatStat(secondPlayer[stat.key] as number | null, stat.format)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function fetchSeasons() {
  const response = await fetch(`${apiBaseUrl}/seasons`);

  if (!response.ok) {
    throw new Error("Failed to fetch seasons");
  }

  return (await response.json()) as number[];
}

async function fetchBattingStats(season: number, playerName: string) {
  const params = new URLSearchParams({
    season: String(season),
    playerName,
    limit: "25"
  });

  const response = await fetch(`${apiBaseUrl}/batting-stats?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch batting stats");
  }

  return (await response.json()) as BattingStatRow[];
}

function getWinner(firstPlayer: BattingStatRow, secondPlayer: BattingStatRow, stat: ComparisonStat) {
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

function formatStat(value: number | null, format: ComparisonStat["format"]) {
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
