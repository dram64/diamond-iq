"""GET /api/standings/{season} — division standings.

503 stub. STANDINGS#<season> ingestion is not yet implemented (deferred to
Phase 5L+). The endpoint shape and routing are wired up so the frontend can
integrate against a stable contract; the response is an explicit
data_not_yet_available error until the partition has rows. Documented in
ADR 012 Phase 5E amendment.
"""

from __future__ import annotations

from typing import Any

from api_responses import build_error_response
from boto3.dynamodb.conditions import Key

CACHE_MAX_AGE_SECONDS = 900


def handle(event: dict[str, Any], *, table: Any) -> dict[str, Any]:
    path_params = (event or {}).get("pathParameters") or {}
    raw_season = path_params.get("season")
    try:
        season = int(raw_season) if raw_season is not None else None
    except (TypeError, ValueError):
        season = None
    if season is None:
        return build_error_response(400, "invalid_season", "season must be an integer year")

    resp = table.query(
        KeyConditionExpression=Key("PK").eq(f"STANDINGS#{season}"),
        Limit=1,
    )
    if resp.get("Items"):
        # Sentinel — not expected to fire until ingestion lands; if it does, we
        # haven't yet implemented the projection logic so respond with the same
        # shape so the frontend doesn't break.
        return build_error_response(
            503,
            "data_not_yet_available",
            "Standings ingestion is implemented but response projection is not yet wired",
            details={"season": season},
        )

    return build_error_response(
        503,
        "data_not_yet_available",
        f"Standings ingestion not yet enabled for season {season}",
        details={"season": season},
    )
