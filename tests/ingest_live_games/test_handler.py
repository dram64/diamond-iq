"""Tests for the ingest_live_games Lambda handler."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest
from ingest_live_games.handler import lambda_handler
from shared.dynamodb import list_todays_games
from shared.mlb_client import MLBAPIError

# All tests in this module need the moto-mocked table.
pytestmark = pytest.mark.usefixtures("dynamodb_table")


# ── Helpers ──────────────────────────────────────────────────────────


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


def _empty_payload() -> dict[str, Any]:
    return {"dates": []}


def _by_date_response(per_date: dict[str, dict[str, Any]]):
    """side_effect that returns different payloads per `today=` kwarg."""

    def side_effect(*_args, today=None, **_kwargs):
        if today is None:
            return _empty_payload()
        return per_date.get(today.isoformat(), _empty_payload())

    return side_effect


def _expected_dates() -> tuple[str, str]:
    today = datetime.now(UTC).date()
    yesterday = today - timedelta(days=1)
    return yesterday.isoformat(), today.isoformat()


# ── Mixed-slate writing ──────────────────────────────────────────────


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_writes_only_live_games_from_mixed_slate(mock_fetch, games_table_name: str) -> None:
    yesterday, today = _expected_dates()
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _empty_payload(),
            today: _payload(
                [
                    _live_raw(101, today),
                    _live_raw(102, today),
                    _final_raw(103, today),
                    _preview_raw(104, today),
                    _live_raw(105, today),
                ],
                date_iso=today,
            ),
        }
    )

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["dates_queried"] == [yesterday, today]
    assert result["total_games_in_schedule"] == 5
    assert result["live_games_processed"] == 3
    assert result["games_written"] == 3
    assert result["games_failed"] == 0

    written = list_todays_games(today, table_name=games_table_name)
    assert {g.game_pk for g in written} == {101, 102, 105}


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_combines_live_games_across_two_dates(mock_fetch, games_table_name: str) -> None:
    yesterday, today = _expected_dates()
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _payload([_live_raw(1, yesterday)], date_iso=yesterday),
            today: _payload(
                [_live_raw(2, today), _live_raw(3, today)],
                date_iso=today,
            ),
        }
    )

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 3
    assert result["live_games_processed"] == 3
    assert result["games_written"] == 3

    yesterday_games = list_todays_games(yesterday, table_name=games_table_name)
    today_games = list_todays_games(today, table_name=games_table_name)
    all_pks = {g.game_pk for g in yesterday_games} | {g.game_pk for g in today_games}
    assert all_pks == {1, 2, 3}


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_writes_all_live_games_from_real_fixture(
    mock_fetch,
    mlb_schedule_fixture: dict[str, Any],
    games_table_name: str,
) -> None:
    yesterday, today = _expected_dates()
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _empty_payload(),
            today: mlb_schedule_fixture,
        }
    )
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

    # MLB schedule entries can roll into the next UTC day; check the fixture's
    # nominal date plus the day after to capture late-night starts.
    from datetime import date as _date

    base = _date.fromisoformat(fixture_date)
    written = list_todays_games(fixture_date, table_name=games_table_name) + list_todays_games(
        (base + timedelta(days=1)).isoformat(), table_name=games_table_name
    )
    assert len(written) == expected_live


# ── Self-throttle paths ──────────────────────────────────────────────


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_empty_schedule_returns_zero_writes(mock_fetch) -> None:
    mock_fetch.return_value = _empty_payload()

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 0
    assert result["live_games_processed"] == 0
    assert result["games_written"] == 0
    assert result["games_failed"] == 0


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_no_live_games_across_either_date_returns_zero_writes(mock_fetch) -> None:
    yesterday, today = _expected_dates()
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _payload([_final_raw(1, yesterday)], date_iso=yesterday),
            today: _payload([_preview_raw(2, today)], date_iso=today),
        }
    )

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 2
    assert result["live_games_processed"] == 0
    assert result["games_written"] == 0


# ── Partial / total failure ──────────────────────────────────────────


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_partial_failure_one_date_succeeds(mock_fetch, games_table_name: str) -> None:
    """If one date errors, the other date's games are still written."""
    yesterday, today = _expected_dates()

    def side_effect(*_args, today=None, **_kwargs):
        if today is None:
            return _empty_payload()
        if today.isoformat() == yesterday:
            raise MLBAPIError("upstream 503 for yesterday", status=503)
        return _payload([_live_raw(42, today.isoformat())], date_iso=today.isoformat())

    mock_fetch.side_effect = side_effect

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["live_games_processed"] == 1
    assert result["games_written"] == 1
    assert result["games_failed"] == 0

    written = list_todays_games(today, table_name=games_table_name)
    assert {g.game_pk for g in written} == {42}


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_both_dates_fail_returns_failure_summary(mock_fetch) -> None:
    mock_fetch.side_effect = MLBAPIError("upstream 503", status=503)

    result = lambda_handler({}, None)

    assert result["ok"] is False
    assert result["reason"] == "mlb_api_error"
    assert result["games_written"] == 0
    assert result["games_failed"] == 0


# ── Per-game failure isolation ───────────────────────────────────────


@patch("ingest_live_games.handler.put_game")
@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_per_game_write_failure_does_not_crash_batch(mock_fetch, mock_put) -> None:
    yesterday, today = _expected_dates()
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _empty_payload(),
            today: _payload(
                [_live_raw(1, today), _live_raw(2, today), _live_raw(3, today)],
                date_iso=today,
            ),
        }
    )

    def selective_put(game, table_name=None):  # noqa: ARG001
        if game.game_pk == 2:
            raise RuntimeError("simulated write failure")

    mock_put.side_effect = selective_put

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["live_games_processed"] == 3
    assert result["games_written"] == 2
    assert result["games_failed"] == 1


# ── Idempotency / dedup ──────────────────────────────────────────────


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_idempotent_writes(mock_fetch, games_table_name: str) -> None:
    yesterday, today = _expected_dates()
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _empty_payload(),
            today: _payload([_live_raw(1, today), _live_raw(2, today)], date_iso=today),
        }
    )

    lambda_handler({}, None)
    after_first = list_todays_games(today, table_name=games_table_name)

    lambda_handler({}, None)
    after_second = list_todays_games(today, table_name=games_table_name)

    assert {g.game_pk for g in after_first} == {g.game_pk for g in after_second}
    assert len(after_first) == len(after_second) == 2


@patch("ingest_live_games.handler.fetch_todays_schedule")
def test_dedupes_same_game_pk_across_two_date_responses(mock_fetch, games_table_name: str) -> None:
    """Defensive: if MLB returns the same game under both date queries, write it once."""
    yesterday, today = _expected_dates()
    duplicate = _live_raw(777, today)
    mock_fetch.side_effect = _by_date_response(
        {
            yesterday: _payload([duplicate], date_iso=yesterday),
            today: _payload([duplicate], date_iso=today),
        }
    )

    result = lambda_handler({}, None)

    assert result["ok"] is True
    assert result["total_games_in_schedule"] == 2
    assert result["live_games_processed"] == 1
    assert result["games_written"] == 1

    written = list_todays_games(today, table_name=games_table_name)
    assert len(written) == 1
    assert written[0].game_pk == 777
