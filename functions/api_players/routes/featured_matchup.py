"""GET /api/featured-matchup — deterministic daily-rotating player pair.

Phase 6 home-page feature. Picks two hitters from the STATS#<season>#hitting
partition, ranking by wOBA top-10 in-memory, prefers different teams, and
seeds the pick against the date so the same pair shows up across page
reloads within the same UTC day but rotates the next day.

Heuristic (documented in ADR 015 Phase 6):
    1. Query STATS#<season>#hitting and sort by wOBA descending.
       Take the top 10 by wOBA.
    2. Hash (date_iso, season) → seed; sample 2 indices from [0..N).
    3. If both sampled indices have the same team_id, retry with the
       next deterministic permutation. After 3 retries with no
       cross-team pair, fall back to the seeded pair anyway.
    4. If the partition has fewer than 2 rows (off-season, freshly-cut
       season), return 503 data_not_yet_available.

Output:
    {
        "data": {
            "date": "2026-04-30",
            "player_ids": [int, int],
            "selection_reason": "top-10 wOBA, deterministic by date"
        },
        "meta": { season, timestamp, cache_max_age_seconds }
    }
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from api_responses import build_data_response, build_error_response
from boto3.dynamodb.conditions import Key
from shared.keys import player_global_pk, player_sk, stats_pk

CACHE_MAX_AGE_SECONDS = 3600  # 1 hour — pair is stable through the UTC day
LEADERBOARD_TOP_N = 10
SAMPLE_SIZE = 2
DIFFERENT_TEAM_RETRIES = 3


def _resolve_season(now: datetime | None = None) -> int:
    return (now or datetime.now(UTC)).year


def _today_iso(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).date().isoformat()


def _seed_for(date_iso: str, season: int) -> int:
    """Stable 32-bit seed derived from date + season."""
    digest = hashlib.sha256(f"{date_iso}#{season}".encode()).digest()
    return int.from_bytes(digest[:4], "big")


def _read_top_woba(table: Any, season: int) -> list[dict[str, Any]]:
    """Query the STATS#<season>#hitting partition, sort by wOBA desc, top N.

    Phase 5D pre-computes wOBA into each row, so we can sort in memory.
    The hitting partition has ~150-200 qualified hitters in season; one
    Query + in-memory sort is well under 100 ms p99.
    """
    resp = table.query(KeyConditionExpression=Key("PK").eq(stats_pk(season, "hitting")))
    items = resp.get("Items") or []
    # Filter to rows with a numeric woba; sort desc.
    scored: list[tuple[float, dict[str, Any]]] = []
    for it in items:
        w = it.get("woba")
        try:
            woba = float(w) if w is not None else None
        except (TypeError, ValueError):
            woba = None
        if woba is None:
            continue
        scored.append((woba, it))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:LEADERBOARD_TOP_N]]


def _read_player_metadata(table: Any, person_id: int) -> dict[str, Any] | None:
    return table.get_item(Key={"PK": player_global_pk(), "SK": player_sk(person_id)}).get("Item")


def _pick_two(rows: list[dict[str, Any]], seed: int) -> tuple[int, int]:
    """Pick two indices deterministically. Prefers cross-team."""
    n = len(rows)
    # First-attempt indices: simple modulo on derived offsets.
    primary = seed % n
    for offset in range(1, DIFFERENT_TEAM_RETRIES + 1):
        secondary = (primary + offset + (seed >> 8)) % n
        if secondary == primary:
            secondary = (secondary + 1) % n
        team_a = rows[primary].get("team_id")
        team_b = rows[secondary].get("team_id")
        if team_a is None or team_b is None or team_a != team_b:
            return primary, secondary
    # All retries collided on team_id — return whatever we have.
    fallback = (primary + 1) % n
    return primary, fallback


def handle(
    event: dict[str, Any], *, table: Any, now: datetime | None = None
) -> dict[str, Any]:  # noqa: ARG001
    season = _resolve_season(now)
    date_iso = _today_iso(now)

    rows = _read_top_woba(table, season)
    if len(rows) < SAMPLE_SIZE:
        return build_error_response(
            503,
            "data_not_yet_available",
            "Featured-matchup leaderboard has fewer than 2 entries",
            details={"season": season, "leaderboard_rows": len(rows)},
        )

    seed = _seed_for(date_iso, season)
    idx_a, idx_b = _pick_two(rows, seed)
    row_a, row_b = rows[idx_a], rows[idx_b]

    pid_a = int(row_a["person_id"])
    pid_b = int(row_b["person_id"])

    # Light metadata enrichment so the home-page card can render names + teams
    # without a follow-up /api/players/compare round-trip on first paint.
    meta_a = _read_player_metadata(table, pid_a)
    meta_b = _read_player_metadata(table, pid_b)

    payload = {
        "date": date_iso,
        "player_ids": [pid_a, pid_b],
        "players": [
            {
                "person_id": pid_a,
                "full_name": (meta_a or {}).get("full_name") or row_a.get("player_name"),
                "team_id": row_a.get("team_id"),
                "primary_position_abbr": (meta_a or {}).get("primary_position_abbr"),
                "woba": row_a.get("woba"),
            },
            {
                "person_id": pid_b,
                "full_name": (meta_b or {}).get("full_name") or row_b.get("player_name"),
                "team_id": row_b.get("team_id"),
                "primary_position_abbr": (meta_b or {}).get("primary_position_abbr"),
                "woba": row_b.get("woba"),
            },
        ],
        "selection_reason": "top-10 wOBA, deterministic by date",
    }
    return build_data_response(
        payload,
        season=season,
        cache_max_age_seconds=CACHE_MAX_AGE_SECONDS,
    )
