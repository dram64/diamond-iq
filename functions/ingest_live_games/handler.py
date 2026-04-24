"""EventBridge-triggered Lambda that ingests today's live MLB games into DynamoDB.

Designed to be self-throttling and idempotent:
  - If the schedule has no live games, exit immediately (no DynamoDB writes).
  - Per-game write failures are caught and counted, not raised — one bad game
    doesn't sink the whole batch.
  - Top-level MLB API errors are caught and reported in the response rather
    than re-raised, so Lambda's automatic retry doesn't hammer a transient
    upstream outage. The next scheduled invocation will try again.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from shared.dynamodb import put_game
from shared.log import get_logger
from shared.mlb_client import MLBAPIError, fetch_todays_schedule
from shared.models import normalize_game

logger = get_logger(__name__)


def _failure_summary(date_iso: str, reason: str) -> dict[str, Any]:
    return {
        "ok": False,
        "reason": reason,
        "date": date_iso,
        "total_games_in_schedule": 0,
        "live_games_processed": 0,
        "games_written": 0,
        "games_failed": 0,
    }


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    request_id = getattr(context, "aws_request_id", None) if context else None
    today_iso = date.today().isoformat()
    log_ctx = {"request_id": request_id, "date": today_iso}

    try:
        payload = fetch_todays_schedule()
    except MLBAPIError as e:
        logger.error(
            "MLB API call failed; aborting ingest run",
            extra={**log_ctx, "error": str(e), "status": getattr(e, "status", None)},
        )
        return _failure_summary(today_iso, "mlb_api_error")

    games_raw: list[dict[str, Any]] = []
    for d in payload.get("dates") or []:
        games_raw.extend(d.get("games") or [])

    total_games = len(games_raw)
    live_raw = [g for g in games_raw if (g.get("status") or {}).get("abstractGameState") == "Live"]

    # Self-throttle: nothing live, no DynamoDB writes, fast exit.
    if not live_raw:
        logger.info(
            "No live games in schedule; skipping write",
            extra={**log_ctx, "total_games_in_schedule": total_games},
        )
        return {
            "ok": True,
            "date": today_iso,
            "total_games_in_schedule": total_games,
            "live_games_processed": 0,
            "games_written": 0,
            "games_failed": 0,
        }

    written = 0
    failed = 0
    for raw in live_raw:
        game_pk = raw.get("gamePk") if isinstance(raw, dict) else None
        try:
            game = normalize_game(raw)
            put_game(game)
            written += 1
        except Exception as e:  # noqa: BLE001 - per-game isolation on purpose
            failed += 1
            logger.error(
                "Failed to write game",
                extra={**log_ctx, "game_pk": game_pk, "error": str(e)},
            )

    summary = {
        "ok": True,
        "date": today_iso,
        "total_games_in_schedule": total_games,
        "live_games_processed": len(live_raw),
        "games_written": written,
        "games_failed": failed,
    }
    logger.info("Ingest run complete", extra={**log_ctx, **summary})
    return summary
