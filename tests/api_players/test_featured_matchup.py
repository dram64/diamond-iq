"""Tests for GET /api/featured-matchup (Phase 6)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from unittest.mock import patch

import boto3
from api_players.handler import lambda_handler


def _seed_leaderboard(table: Any, season: int, rows: list[tuple[int, int, str, str]]) -> None:
    """rows: (rank, person_id, woba_str, team_id) — woba is the upstream display string.

    Phase 6: featured-matchup reads the STATS#<season>#hitting partition and
    sorts by wOBA in-memory; we seed that shape here. The rank tuple element
    is preserved for caller readability but not stored — order is decided by
    the route's sort.
    """
    from decimal import Decimal

    for _rank, pid, woba, team_id in rows:
        # Convert ".400" → Decimal("0.400") so DynamoDB stores a Number.
        decimal_woba = Decimal("0" + woba) if woba.startswith(".") else Decimal(woba)
        table.put_item(
            Item={
                "PK": f"STATS#{season}#hitting",
                "SK": f"STATS#{pid}",
                "person_id": pid,
                "player_name": f"Player {pid}",
                "full_name": f"Player {pid}",
                "team_id": int(team_id),
                "woba": decimal_woba,
            }
        )


def _seed_player_meta(table: Any, pid: int, name: str, pos: str = "OF") -> None:
    table.put_item(
        Item={
            "PK": "PLAYER#GLOBAL",
            "SK": f"PLAYER#{pid}",
            "person_id": pid,
            "full_name": name,
            "primary_position_abbr": pos,
        }
    )


def _invoke(games_table_name: str) -> dict[str, Any]:
    event = {"routeKey": "GET /api/featured-matchup", "pathParameters": {}}
    return lambda_handler(event, None, table_name=games_table_name)


# Patch routes.featured_matchup's datetime.now via a freezegun-style monkey
# at module level. Using unittest.mock to inject a fixed clock.
def _patched_now(date_iso: str) -> datetime:
    return datetime.fromisoformat(date_iso + "T12:00:00+00:00").astimezone(UTC)


def test_featured_matchup_happy_path(seeded_table, games_table_name):  # noqa: ARG001
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(games_table_name)
    rows = [
        (i + 1, 100 + i, f".{400 - i * 5}", 130 + i) for i in range(10)
    ]  # 10 players, all different teams
    _seed_leaderboard(table, 2026, rows)
    for _, pid, _, _ in rows:
        _seed_player_meta(table, pid, f"Player {pid}")

    fixed_now = _patched_now("2026-04-30")
    with patch("routes.featured_matchup.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_now
        mock_dt.fromisoformat = datetime.fromisoformat
        response = _invoke(games_table_name)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["data"]["date"] == "2026-04-30"
    assert len(body["data"]["player_ids"]) == 2
    assert body["data"]["player_ids"][0] != body["data"]["player_ids"][1]
    assert len(body["data"]["players"]) == 2


def test_featured_matchup_503_when_leaderboard_thin(
    dynamodb_table, games_table_name
):  # noqa: ARG001
    # Use the bare dynamodb_table fixture (not seeded_table) so the STATS
    # partition starts empty; we seed exactly one row to verify the 503 path.
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(games_table_name)
    _seed_leaderboard(table, 2026, [(1, 100, ".400", 147)])  # only 1 row

    fixed_now = _patched_now("2026-04-30")
    with patch("routes.featured_matchup.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_now
        mock_dt.fromisoformat = datetime.fromisoformat
        response = _invoke(games_table_name)
    assert response["statusCode"] == 503
    body = json.loads(response["body"])
    assert body["error"]["code"] == "data_not_yet_available"


def test_featured_matchup_deterministic_within_day(seeded_table, games_table_name):  # noqa: ARG001
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(games_table_name)
    rows = [(i + 1, 100 + i, f".{400 - i * 5}", 130 + i) for i in range(10)]
    _seed_leaderboard(table, 2026, rows)
    for _, pid, _, _ in rows:
        _seed_player_meta(table, pid, f"Player {pid}")

    fixed_now = _patched_now("2026-04-30")
    with patch("routes.featured_matchup.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_now
        mock_dt.fromisoformat = datetime.fromisoformat
        first = json.loads(_invoke(games_table_name)["body"])
        second = json.loads(_invoke(games_table_name)["body"])
    assert first["data"]["player_ids"] == second["data"]["player_ids"]


def test_featured_matchup_rotates_across_days(seeded_table, games_table_name):  # noqa: ARG001
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(games_table_name)
    rows = [(i + 1, 100 + i, f".{400 - i * 5}", 130 + i) for i in range(10)]
    _seed_leaderboard(table, 2026, rows)
    for _, pid, _, _ in rows:
        _seed_player_meta(table, pid, f"Player {pid}")

    pairs = []
    for date_iso in ("2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01"):
        fixed_now = _patched_now(date_iso)
        with patch("routes.featured_matchup.datetime") as mock_dt:
            mock_dt.now.return_value = fixed_now
            mock_dt.fromisoformat = datetime.fromisoformat
            body = json.loads(_invoke(games_table_name)["body"])
            pairs.append(tuple(sorted(body["data"]["player_ids"])))
    # Across 4 different days, at least 2 distinct pairs (the heuristic should
    # rotate; this test guards against an off-by-one that would pin to day 0).
    assert len({p for p in pairs}) >= 2


def test_featured_matchup_prefers_different_teams(seeded_table, games_table_name):  # noqa: ARG001
    """When seeded indices share a team, the next-team-different fallback fires."""
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(games_table_name)
    # First two rows on the same team, the rest on different teams.
    rows = [
        (1, 100, ".400", 147),
        (2, 101, ".395", 147),
    ] + [(r + 1, 102 + r, f".{390 - r * 5}", 130 + r) for r in range(8)]
    _seed_leaderboard(table, 2026, rows)
    for _, pid, _, _ in rows:
        _seed_player_meta(table, pid, f"Player {pid}")

    fixed_now = _patched_now("2026-04-30")
    with patch("routes.featured_matchup.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_now
        mock_dt.fromisoformat = datetime.fromisoformat
        body = json.loads(_invoke(games_table_name)["body"])
    chosen = body["data"]["players"]
    assert chosen[0]["team_id"] != chosen[1]["team_id"]
