"""Tests for GET /api/leaders/{group}/{stat}."""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

import boto3
from api_players.handler import lambda_handler


def _event(group: str, stat: str, *, limit: int | None = None) -> dict:
    qs: dict[str, str] = {}
    if limit is not None:
        qs["limit"] = str(limit)
    return {
        "routeKey": "GET /api/leaders/{group}/{stat}",
        "pathParameters": {"group": group, "stat": stat},
        "queryStringParameters": qs or None,
    }


def _seed_leader_pool(games_table_name: str) -> None:
    """Add a 5-player hitting + 4-player pitching pool with distinct stat values."""
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(games_table_name)
    hitters: list[dict[str, Any]] = []
    # HR values intentionally distinct from the seeded_table base pool (which
    # includes Alpha at 25 HR and Charlie at 8 HR) to keep top-3 deterministic.
    for i, hr in enumerate([12, 35, 22, 6, 28], start=1):
        hitters.append(
            {
                "PK": "STATS#2026#hitting",
                "SK": f"STATS#L{i}",
                "person_id": 100 + i,
                "season": 2026,
                "group": "hitting",
                "full_name": f"Leader{i}",
                "avg": f".{200 + i * 10}",
                "obp": f".{300 + i * 10}",
                "slg": f".{400 + i * 10}",
                "ops": f".{700 + i * 10}",
                "home_runs": Decimal(str(hr)),
                "rbi": Decimal(str(hr * 3)),
                "woba": Decimal(f"0.{300 + i * 15}"),
                "ops_plus": Decimal(str(80 + i * 10)),
            }
        )
    for h in hitters:
        table.put_item(Item=h)

    pitchers: list[dict[str, Any]] = []
    for i, era in enumerate(["3.50", "2.10", "4.20", "2.85"], start=1):
        pitchers.append(
            {
                "PK": "STATS#2026#pitching",
                "SK": f"STATS#P{i}",
                "person_id": 200 + i,
                "season": 2026,
                "group": "pitching",
                "full_name": f"Pitcher{i}",
                "era": era,
                "whip": f"1.{i:02d}",
                "innings_pitched": "100.0",
                "strikeouts": Decimal(str(100 + i * 5)),
                "wins": Decimal(str(5 + i)),
                "saves": Decimal("0"),
                "fip": Decimal(f"3.{i:02d}"),
            }
        )
    for p in pitchers:
        table.put_item(Item=p)


def test_leaders_top_hitting_hr(seeded_table, games_table_name) -> None:  # noqa: ARG001
    _seed_leader_pool(games_table_name)
    response = lambda_handler(_event("hitting", "hr", limit=3), None, table_name=games_table_name)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    leaders = body["data"]["leaders"]
    assert len(leaders) == 3
    # Top HR descending across pool: 35, 28, 25 (Alpha) — Leader2, Leader5, Alpha
    assert leaders[0]["home_runs"] == 35
    assert leaders[0]["rank"] == 1
    assert leaders[1]["home_runs"] == 28
    assert leaders[2]["home_runs"] == 25


def test_leaders_pitching_era_ascending(seeded_table, games_table_name) -> None:  # noqa: ARG001
    _seed_leader_pool(games_table_name)
    response = lambda_handler(_event("pitching", "era", limit=3), None, table_name=games_table_name)
    body = json.loads(response["body"])
    leaders = body["data"]["leaders"]
    # Lower ERA is better. Pool: 2.10, 2.50 (Bravo), 2.85, 3.50, 4.20 → top 3
    assert leaders[0]["era"] == "2.10"
    assert leaders[1]["era"] == "2.50"
    assert leaders[2]["era"] == "2.85"
    assert body["data"]["direction"] == "asc"


def test_leaders_woba_uses_5d_computed(seeded_table, games_table_name) -> None:  # noqa: ARG001
    _seed_leader_pool(games_table_name)
    response = lambda_handler(_event("hitting", "woba", limit=2), None, table_name=games_table_name)
    body = json.loads(response["body"])
    assert body["data"]["field"] == "woba"
    leaders = body["data"]["leaders"]
    # Highest woba first (descending)
    assert leaders[0]["woba"] >= leaders[1]["woba"]


def test_leaders_default_limit_is_10(seeded_table, games_table_name) -> None:  # noqa: ARG001
    _seed_leader_pool(games_table_name)
    response = lambda_handler(_event("hitting", "avg"), None, table_name=games_table_name)
    body = json.loads(response["body"])
    assert body["data"]["limit"] == 10


def test_leaders_max_limit_clamped_to_50(seeded_table, games_table_name) -> None:  # noqa: ARG001
    _seed_leader_pool(games_table_name)
    response = lambda_handler(_event("hitting", "hr", limit=200), None, table_name=games_table_name)
    body = json.loads(response["body"])
    assert body["data"]["limit"] == 50


def test_leaders_invalid_group_400(seeded_table, games_table_name) -> None:  # noqa: ARG001
    response = lambda_handler(_event("fielding", "errors"), None, table_name=games_table_name)
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["error"]["code"] == "invalid_group"


def test_leaders_invalid_stat_400(seeded_table, games_table_name) -> None:  # noqa: ARG001
    response = lambda_handler(_event("hitting", "babip"), None, table_name=games_table_name)
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["error"]["code"] == "invalid_stat"


def test_leaders_k_maps_to_strikeouts(seeded_table, games_table_name) -> None:  # noqa: ARG001
    """URL token 'k' must resolve to the stored 'strikeouts' attribute."""
    _seed_leader_pool(games_table_name)
    response = lambda_handler(_event("pitching", "k", limit=2), None, table_name=games_table_name)
    body = json.loads(response["body"])
    assert body["data"]["field"] == "strikeouts"
    assert body["data"]["leaders"][0]["strikeouts"] >= body["data"]["leaders"][1]["strikeouts"]
