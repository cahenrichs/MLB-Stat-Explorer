import argparse
import json
import math
from pathlib import Path

import pandas as pd
from pybaseball import batting_stats
from requests.exceptions import HTTPError


def clean_value(value):
    if pd.isna(value):
        return None

    if isinstance(value, float) and not math.isfinite(value):
        return None

    return value


def clean_record(record):
    return {key: clean_value(value) for key, value in record.items()}


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

    records = [clean_record(record) for record in df.to_dict(orient="records")]

    output_dir = Path(__file__).parent / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"fangraphs-batting-{args.season}.json"
    output_path.write_text(json.dumps(records, indent=2), encoding="utf-8")

    print(f"Wrote {len(records)} rows to {output_path}")


if __name__ == "__main__":
    main()
