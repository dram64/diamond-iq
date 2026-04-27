"""GET /api/players/{personId} — player metadata + season + computed stats."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from shared.keys import player_global_pk, player_sk, stats_pk, stats_sk

from ..responses import build_data_response, build_error_response

CACHE_MAX_AGE_SECONDS = 300


def _resolve_season(now: datetime | None = None) -> int:
    return (now or datetime.now(UTC)).year


def _strip_pk_sk(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    return {k: v for k, v in item.items() if k not in ("PK", "SK")}


def handle(event: dict[str, Any], *, table: Any, now: datetime | None = None) -> dict[str, Any]:
    path_params = (event or {}).get("pathParameters") or {}
    raw_id = path_params.get("personId")
    if raw_id is None:
        return build_error_response(400, "missing_person_id", "personId is required")
    try:
        person_id = int(raw_id)
    except (TypeError, ValueError):
        return build_error_response(
            400, "invalid_person_id", f"personId must be an integer, got {raw_id!r}"
        )

    season = _resolve_season(now)

    metadata_resp = table.get_item(Key={"PK": player_global_pk(), "SK": player_sk(person_id)})
    metadata = metadata_resp.get("Item")
    if not metadata:
        return build_error_response(404, "player_not_found", f"No player with id {person_id}")

    hitting = table.get_item(
        Key={"PK": stats_pk(season, "hitting"), "SK": stats_sk(person_id)}
    ).get("Item")
    pitching = table.get_item(
        Key={"PK": stats_pk(season, "pitching"), "SK": stats_sk(person_id)}
    ).get("Item")

    payload = {
        "metadata": _strip_pk_sk(metadata),
        "hitting": _strip_pk_sk(hitting),
        "pitching": _strip_pk_sk(pitching),
    }
    return build_data_response(payload, season=season, cache_max_age_seconds=CACHE_MAX_AGE_SECONDS)
