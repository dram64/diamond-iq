"""Tests for the 503 stubs (standings + hardest-hit pending ingestion)."""

from __future__ import annotations

import json

from api_players.handler import lambda_handler


def test_standings_503_when_partition_empty(seeded_table, games_table_name) -> None:
    event = {
        "routeKey": "GET /api/standings/{season}",
        "pathParameters": {"season": "2026"},
    }
    response = lambda_handler(event, None, table_name=games_table_name)
    assert response["statusCode"] == 503
    body = json.loads(response["body"])
    assert body["error"]["code"] == "data_not_yet_available"
    assert body["error"]["details"]["season"] == 2026


def test_hardest_hit_503_when_partition_empty(seeded_table, games_table_name) -> None:
    event = {
        "routeKey": "GET /api/hardest-hit/{date}",
        "pathParameters": {"date": "2026-04-26"},
    }
    response = lambda_handler(event, None, table_name=games_table_name)
    assert response["statusCode"] == 503
    body = json.loads(response["body"])
    assert body["error"]["code"] == "data_not_yet_available"


def test_hardest_hit_400_for_bad_date(seeded_table, games_table_name) -> None:
    event = {
        "routeKey": "GET /api/hardest-hit/{date}",
        "pathParameters": {"date": "2026-13-99"},
    }
    response = lambda_handler(event, None, table_name=games_table_name)
    # The regex catches "2026-13-99" as well-formed; explicit non-YYYY-MM-DD:
    event["pathParameters"]["date"] = "not-a-date"
    response = lambda_handler(event, None, table_name=games_table_name)
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["error"]["code"] == "invalid_date"
