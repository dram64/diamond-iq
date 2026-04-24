"""HTTP client for the MLB Stats API.

Stdlib-only on purpose: keeps the Lambda zip small and cold start fast.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import date
from typing import Any

USER_AGENT = "diamond-iq/0.1 (+https://github.com/dram64/diamond-iq)"
SCHEDULE_BASE = "https://statsapi.mlb.com/api/v1"
LIVE_BASE = "https://statsapi.mlb.com/api/v1.1"
DEFAULT_TIMEOUT_SECONDS = 10.0


class MLBAPIError(Exception):
    """Raised on a non-success response from the MLB Stats API."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class MLBNotFoundError(MLBAPIError):
    """Raised on a 404 from the MLB Stats API."""


class MLBTimeoutError(MLBAPIError):
    """Raised when a request to the MLB Stats API times out."""


def _request(url: str, *, timeout: float) -> Any:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - https only
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise MLBNotFoundError(f"MLB API 404: {url}", status=404) from e
        raise MLBAPIError(f"MLB API {e.code}: {url}", status=e.code) from e
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError):
            raise MLBTimeoutError(f"MLB API timeout: {url}") from e
        raise MLBAPIError(f"MLB API request failed: {url} ({e.reason})") from e
    except TimeoutError as e:
        raise MLBTimeoutError(f"MLB API timeout: {url}") from e


def fetch_todays_schedule(
    *,
    today: date | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Return the raw MLB Stats API schedule payload for the given date (defaults to today)."""
    when = today or date.today()
    url = f"{SCHEDULE_BASE}/schedule?sportId=1&date={when.isoformat()}&hydrate=linescore,team"
    return _request(url, timeout=timeout)


def fetch_game(game_pk: int, *, timeout: float = DEFAULT_TIMEOUT_SECONDS) -> dict[str, Any]:
    """Return the raw MLB Stats API live-feed payload for a single game."""
    url = f"{LIVE_BASE}/game/{game_pk}/feed/live"
    return _request(url, timeout=timeout)
