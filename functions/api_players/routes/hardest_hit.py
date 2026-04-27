"""GET /api/hardest-hit/{date} — hardest-hit balls for a date.

503 stub. HITS#<date> ingestion is the Option 4 stream-extension that has
not yet shipped (deferred to a future Phase 5C+ option). The endpoint shape
and routing are wired up so the frontend can integrate; response is an
explicit data_not_yet_available error until the partition has rows.
Documented in ADR 012 Phase 5E amendment.
"""

from __future__ import annotations

import re
from typing import Any

from api_responses import build_error_response
from boto3.dynamodb.conditions import Key

CACHE_MAX_AGE_SECONDS = 3600
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def handle(event: dict[str, Any], *, table: Any) -> dict[str, Any]:
    path_params = (event or {}).get("pathParameters") or {}
    date_iso = path_params.get("date")
    if not date_iso or not _DATE_RE.match(date_iso):
        return build_error_response(400, "invalid_date", "date must be YYYY-MM-DD")

    resp = table.query(
        KeyConditionExpression=Key("PK").eq(f"HITS#{date_iso}"),
        Limit=1,
    )
    if resp.get("Items"):
        return build_error_response(
            503,
            "data_not_yet_available",
            "Hardest-hit ingestion is implemented but response projection is not yet wired",
            details={"date": date_iso},
        )

    return build_error_response(
        503,
        "data_not_yet_available",
        f"Hardest-hit ingestion not yet enabled for {date_iso}",
        details={"date": date_iso},
    )
