import argparse
import json
import math
from pathlib import Path

import pandas as pd
from pybaseball import batting_stats
from requests.exceptions import HTTPError


REQUIRED_FIELDS = [
    "IDfg",
    "Name",
    "Season",
    "Team",
    "G",
    "PA",
    "HR",
    "R",
    "RBI",
    "SB",
    "BB%",
    "K%",
    "AVG",
    "OBP",
    "SLG",
    "OPS",
    "wOBA",
    "wRC+",
    "WAR",
]

HEADER_ALIASES = {
    "PlayerName": "Name",
    "NameASCII": "Name",
    "playerid": "IDfg",
    "IDfg+": "IDfg",
    "TeamNameAbb": "Team",
    "BB_pct": "BB%",
    "BB_percent": "BB%",
    "bb_percent": "BB%",
    "K_pct": "K%",
    "K_percent": "K%",
    "k_percent": "K%",
    "wRCPlus": "wRC+",
    "WRC+": "wRC+",
    "wrc_plus": "wRC+",
}


def clean_value(value):
    if pd.isna(value):
        return None

    if isinstance(value, float) and not math.isfinite(value):
        return None

    return value


def clean_record(record):
    return {key: clean_value(value) for key, value in record.items()}


def normalize_headers(df):
    normalized = df.copy()

    for alias, canonical in HEADER_ALIASES.items():
        if alias in normalized.columns and canonical not in normalized.columns:
            normalized[canonical] = normalized[alias]

    return normalized


def validate_required_fields(df):
    missing_fields = [field for field in REQUIRED_FIELDS if field not in df.columns]

    if missing_fields:
        missing = ", ".join(missing_fields)
        detected = ", ".join(str(column) for column in df.columns)
        raise ValueError(
            f"Missing required FanGraphs fields: {missing}. Detected headers: {detected}"
        )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fetch FanGraphs season batting stats through pybaseball."
    )
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument(
        "--csv",
        type=Path,
        help="Use a manually exported FanGraphs CSV when pybaseball/FanGraphs blocks automated fetches.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.csv:
        df = pd.read_csv(args.csv)
        if "Season" not in df.columns:
            df["Season"] = args.season
    else:
        try:
            df = batting_stats(args.season, args.season, qual=0, ind=0)
        except HTTPError as error:
            raise SystemExit(
                "FanGraphs rejected the automated pybaseball request. "
                "Download a FanGraphs batting leaderboard CSV for this season, then run: "
                f"python ingestion/fetch_fangraphs_batting.py --season {args.season} --csv path/to/file.csv"
            ) from error

    df = normalize_headers(df)
    validate_required_fields(df)

    records = [clean_record(record) for record in df.to_dict(orient="records")]

    output_dir = Path(__file__).parent / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"fangraphs-batting-{args.season}.json"
    output_path.write_text(json.dumps(records, indent=2), encoding="utf-8")

    print(f"Wrote {len(records)} rows to {output_path}")


if __name__ == "__main__":
    main()
