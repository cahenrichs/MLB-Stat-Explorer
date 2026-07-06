import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from fetch_fangraphs_batting import normalize_headers, validate_required_fields


BASE_ROW = {
    "IDfg": 15640,
    "Name": "Aaron Judge",
    "Season": 2024,
    "Team": "NYY",
    "G": 158,
    "PA": 704,
    "HR": 58,
    "R": 122,
    "RBI": 144,
    "SB": 10,
    "BB%": "18.9%",
    "K%": "24.3%",
    "AVG": ".322",
    "OBP": ".458",
    "SLG": ".701",
    "OPS": "1.159",
    "wOBA": ".476",
    "wRC+": 218,
    "WAR": "11.2",
}


class FetchFangraphsBattingTests(unittest.TestCase):
    def test_normalize_headers_adds_canonical_aliases(self):
        row = {
            **BASE_ROW,
            "PlayerName": "Aaron Judge",
            "playerid": 15640,
            "TeamNameAbb": "NYY",
            "BB_pct": "18.9%",
            "K_percent": "24.3%",
            "wRCPlus": 218,
        }
        del row["Name"]
        del row["IDfg"]
        del row["Team"]
        del row["BB%"]
        del row["K%"]
        del row["wRC+"]

        normalized = normalize_headers(pd.DataFrame([row]))

        self.assertEqual(normalized.loc[0, "Name"], "Aaron Judge")
        self.assertEqual(normalized.loc[0, "IDfg"], 15640)
        self.assertEqual(normalized.loc[0, "Team"], "NYY")
        self.assertEqual(normalized.loc[0, "BB%"], "18.9%")
        self.assertEqual(normalized.loc[0, "K%"], "24.3%")
        self.assertEqual(normalized.loc[0, "wRC+"], 218)

    def test_normalize_headers_preserves_original_columns(self):
        normalized = normalize_headers(
            pd.DataFrame([{**BASE_ROW, "PlayerName": "Aaron Judge Alias"}])
        )

        self.assertIn("PlayerName", normalized.columns)
        self.assertEqual(normalized.loc[0, "PlayerName"], "Aaron Judge Alias")

    def test_normalize_headers_does_not_overwrite_canonical_fields(self):
        normalized = normalize_headers(
            pd.DataFrame([{**BASE_ROW, "PlayerName": "Aaron Judge Alias"}])
        )

        self.assertEqual(normalized.loc[0, "Name"], "Aaron Judge")

    def test_validate_required_fields_reports_missing_and_detected_headers(self):
        row = {**BASE_ROW}
        del row["IDfg"]
        del row["wRC+"]

        with self.assertRaisesRegex(
            ValueError,
            r"Missing required FanGraphs fields: IDfg, wRC\+\. Detected headers: Name",
        ):
            validate_required_fields(pd.DataFrame([row]))

    def test_csv_flow_adds_season_before_validation(self):
        row = {**BASE_ROW}
        del row["Season"]
        df = pd.DataFrame([row])

        if "Season" not in df.columns:
            df["Season"] = 2024

        normalized = normalize_headers(df)

        validate_required_fields(normalized)
        self.assertEqual(normalized.loc[0, "Season"], 2024)


if __name__ == "__main__":
    unittest.main()
