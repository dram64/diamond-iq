"""Tests for the ingest_live_games Lambda handler."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from ingest_live_games.handler import lambda_handler
from shared.dynamodb import list_todays_games
from shared.mlb_client import MLBAPIError

# All tests in this module need the moto-mocked table.
pytestmark = pytest.mark.usefixtures("dynamodb_table")


def _live_raw(game_pk: int, date_iso: str = "2026-04-24") -> dict[str, Any]:
    return {
        "gamePk": game_pk,
        "gameDate": f"{date_iso}T19:00:00Z",
        "status": {"abstractGameState": "Live", "detailedState": "In Progress"},
        "teams": {
            "away": {"team": {"id": 1, "name": "Away", "abbreviation": "AWY"}, "score": 0},
            "home": {"team": {"id": 2, "name": "Home", "abbreviation": "HOM"}, "score": 0},
        },
        "linescore": {
            "currentInning": 1,
            "inningHalf": "Top",
            "balls": 0,
            "strikes": 0,
            "outs": 0,
            "teams": {"away": {"runs": 0}, "home": {"runs": 0}},
        },
    }


def _final_raw(game_pk: int, date_iso: str = "2026-04-24") -> dict[str, Any]:
    return {
        "gamePk": game_pk,
        "gameDate": f"{date_iso}T19:00:00Z",
        "status": {"abstractGameState": "Final", "detailedState": "Final"},
        "teams": {
            "away": {"team": {"id": 1, "name": "Away", "abbreviation": "AWY"}, "score": 5},
            "home": {"team": {"id": 2, "name": "Home", "abbreviation": "HOM"}, "score": 3},
        },
    }


def _preview_raw(game_pk: int, date_iso: str = "2026-04-24") -> dict[str, Any]:
    return {
        "gamePk": game_pk,
        "gameDate": f"{date_iso}T22:00:00Z",
        "status": {"abstractGameState": "Preview", "detailedState": "Scheduled"},
        "teams": {
            "away": {"team": {"id": 1, "name": "Away", "abbreviation": "AWY"}},
            "home": {"team": {"id": 2, "name": "Home", "abbreviation": "HOM"}},
        },
    }


def _payload(games: list[dict[str, Any]], date_iso: str = "2026-04-24") -> dict[str, Any]:
    return {"dates": [{"date": date_iso, "games": games}]}


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_writes_only_live_games_from_mixed_slate(mock_fetch, games_table_name: str) -> None:
    mock_fetch.return_value = _payload(
        [
            _live_raw(101),
            _live_raw(102),
            _final_raw(103),
            _preview_raw(104),
            _live_raw(105),
        ]
    )

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 5
    assert result["live_games_processed"] == 3
    assert result["games_written"] == 3
    assert result["games_failed"] == 0

    written = list_todays_games("2026-04-24", table_name=games_table_name)
    assert {g.game_pk for g in written} == {101, 102, 105}


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_writes_all_live_games_from_real_fixture(
    mock_fetch,
    mlb_schedule_fixture: dict[str, Any],
    games_table_name: str,
) -> None:
    mock_fetch.return_value = mlb_schedule_fixture
    fixture_date = mlb_schedule_fixture["dates"][0]["date"]
    expected_live = sum(
        1
        for g in mlb_schedule_fixture["dates"][0]["games"]
        if g["status"]["abstractGameState"] == "Live"
    )

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["live_games_processed"] == expected_live
    assert result["games_written"] == expected_live
    assert result["games_failed"] == 0

    # MLB schedules games by local-date entry, but each game's `gameDate` is in
    # UTC. Late starts on the West Coast can roll into the next UTC day, so a
    # game listed under 2026-04-24 may be persisted under 2026-04-25. Query
    # both to verify all live games landed.
    from datetime import date, timedelta

    base = date.fromisoformat(fixture_date)
    written = list_todays_games(fixture_date, table_name=games_table_name) + list_todays_games(
        (base + timedelta(days=1)).isoformat(), table_name=games_table_name
    )
    assert len(written) == expected_live


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_empty_schedule_returns_zero_writes(mock_fetch) -> None:
    mock_fetch.return_value = {"dates": []}

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 0
    assert result["live_games_processed"] == 0
    assert result["games_written"] == 0
    assert result["games_failed"] == 0


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_no_live_games_returns_zero_writes(mock_fetch) -> None:
    mock_fetch.return_value = _payload([_final_raw(1), _preview_raw(2)])

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 2
    assert result["live_games_processed"] == 0
    assert result["games_written"] == 0


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_mlb_api_error_returns_failure_summary_without_raising(mock_fetch) -> None:
    mock_fetch.side_effect = MLBAPIError("upstream 503", status=503)

    result = lambda_handler({}, None)

    assert result["ok"] is False
    assert result["reason"] == "mlb_api_error"
    assert result["games_written"] == 0
    assert result["games_failed"] == 0


@patch("ingest_live_games.handler.put_game")
@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_per_game_write_failure_does_not_crash_batch(mock_fetch, mock_put) -> None:
    mock_fetch.return_value = _payload([_live_raw(1), _live_raw(2), _live_raw(3)])

    def selective_put(game, table_name=None):  # noqa: ARG001
        if game.game_pk == 2:
            raise RuntimeError("simulated write failure")

    mock_put.side_effect = selective_put

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["live_games_processed"] == 3
    assert result["games_written"] == 2
    assert result["games_failed"] == 1


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_idempotent_writes(mock_fetch, games_table_name: str) -> None:
    mock_fetch.return_value = _payload([_live_raw(1), _live_raw(2)])

    lambda_handler({}, None)
    after_first = list_todays_games("2026-04-24", table_name=games_table_name)

    lambda_handler({}, None)
    after_second = list_todays_games("2026-04-24", table_name=games_table_name)

    assert {g.game_pk for g in after_first} == {g.game_pk for g in after_second}
    assert len(after_first) == len(after_second) == 2
