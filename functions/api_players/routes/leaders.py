"""GET /api/leaders/{group}/{stat} — top-N players by stat with sort direction."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from api_responses import build_data_response, build_error_response
from boto3.dynamodb.conditions import Key
from shared.keys import stats_pk

CACHE_MAX_AGE_SECONDS = 600
DEFAULT_LIMIT = 10
MAX_LIMIT = 50

# Single source of truth for supported leaders + sort direction. The URL token
# may differ from the storage attribute name (e.g. URL "k" → stored
# "strikeouts"); the field key resolves the attribute, the direction key sets
# ascending vs descending.
_LEADER_STATS: dict[str, dict[str, dict[str, str]]] = {
    "hitting": {
        "avg": {"field": "avg", "direction": "desc"},
        "hr": {"field": "home_runs", "direction": "desc"},
        "rbi": {"field": "rbi", "direction": "desc"},
        "ops": {"field": "ops", "direction": "desc"},
        "woba": {"field": "woba", "direction": "desc"},
        "ops_plus": {"field": "ops_plus", "direction": "desc"},
    },
    "pitching": {
        "era": {"field": "era", "direction": "asc"},
        "k": {"field": "strikeouts", "direction": "desc"},
        "whip": {"field": "whip", "direction": "asc"},
        "fip": {"field": "fip", "direction": "asc"},
        "wins": {"field": "wins", "direction": "desc"},
        "saves": {"field": "saves", "direction": "desc"},
    },
}


def _resolve_season(now: datetime | None = None) -> int:
    return (now or datetime.now(UTC)).year


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int | float):
        return Decimal(str(value))
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return Decimal(s)
        except (ArithmeticError, ValueError):
            return None
    return None


def _strip_pk_sk(item: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in item.items() if k not in ("PK", "SK")}


def handle(event: dict[str, Any], *, table: Any, now: datetime | None = None) -> dict[str, Any]:
    path_params = (event or {}).get("pathParameters") or {}
    group = path_params.get("group")
    stat_token = path_params.get("stat")
    if group not in _LEADER_STATS:
        return build_error_response(
            400,
            "invalid_group",
            f"group must be one of {sorted(_LEADER_STATS.keys())}, got {group!r}",
        )
    if stat_token not in _LEADER_STATS[group]:
        return build_error_response(
            400,
            "invalid_stat",
            f"stat must be one of {sorted(_LEADER_STATS[group].keys())}, got {stat_token!r}",
        )

    config = _LEADER_STATS[group][stat_token]
    field = config["field"]
    descending = config["direction"] == "desc"

    qs = (event or {}).get("queryStringParameters") or {}
    raw_limit = qs.get("limit")
    try:
        limit = int(raw_limit) if raw_limit is not None else DEFAULT_LIMIT
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT
    limit = max(1, min(limit, MAX_LIMIT))

    season = _resolve_season(now)
    resp = table.query(KeyConditionExpression=Key("PK").eq(stats_pk(season, group)))
    items = resp.get("Items") or []

    sortable: list[tuple[Decimal, dict[str, Any]]] = []
    for item in items:
        v = _to_decimal(item.get(field))
        if v is None:
            continue
        sortable.append((v, item))
    sortable.sort(key=lambda pair: pair[0], reverse=descending)

    leaders = []
    for rank, (_, item) in enumerate(sortable[:limit], start=1):
        row = _strip_pk_sk(item)
        row["rank"] = rank
        leaders.append(row)

    payload = {
        "group": group,
        "stat": stat_token,
        "field": field,
        "direction": config["direction"],
        "limit": limit,
        "leaders": leaders,
    }
    return build_data_response(payload, season=season, cache_max_age_seconds=CACHE_MAX_AGE_SECONDS)
