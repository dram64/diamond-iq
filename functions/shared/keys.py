"""DynamoDB key formatters for the single-table design.

Centralizes every PK/SK string the project produces so the format
exists in exactly one place. If a partition prefix needs to change,
this is the file to edit; everything else picks it up.

Existing entity types (Phases 9, Option 4):
    PK = GAME#<yyyy-mm-dd>          SK = GAME#<game_pk>
    PK = CONTENT#<yyyy-mm-dd>       SK = RECAP#<game_pk>
                                       | PREVIEW#<game_pk>
                                       | FEATURED#<rank>

Option 5 entities (added Phase 5B+):
    PK = PLAYER#GLOBAL              SK = PLAYER#<personId>
    PK = ROSTER#<season>#<teamId>   SK = ROSTER#<personId>
    PK = STATS#<season>#<group>     SK = STATS#<personId>          (Phase 5C)
    PK = STANDINGS#<season>         SK = STANDINGS#<teamId>        (Phase 5C)
    PK = LEADERBOARD#<season>#<group>#<stat>  SK = LEADERBOARD#<rank>  (Phase 5D)
    PK = HITS#<yyyy-mm-dd>          SK = HIT#<paddedExitVelo>#...  (Phase 5E)
"""

from __future__ import annotations

# ── Phase 5B (this commit) ────────────────────────────────────────────


def player_global_pk() -> str:
    return "PLAYER#GLOBAL"


def player_sk(person_id: int) -> str:
    return f"PLAYER#{person_id}"


def roster_pk(season: int, team_id: int) -> str:
    return f"ROSTER#{season}#{team_id}"


def roster_sk(person_id: int) -> str:
    return f"ROSTER#{person_id}"


# ── Phase 5C ──────────────────────────────────────────────────────────


def daily_stats_pk(date_iso: str) -> str:
    return f"DAILYSTATS#{date_iso}"


def daily_stats_sk(person_id: int, game_pk: int) -> str:
    return f"STATS#{person_id}#{game_pk}"


def stats_pk(season: int, group: str) -> str:
    return f"STATS#{season}#{group}"


def stats_sk(person_id: int) -> str:
    return f"STATS#{person_id}"


# ── Phase 5L ──────────────────────────────────────────────────────────


def standings_pk(season: int) -> str:
    return f"STANDINGS#{season}"


def standings_sk(team_id: int) -> str:
    return f"STANDINGS#{team_id}"


def hits_pk(date_iso: str) -> str:
    return f"HITS#{date_iso}"


# Encoding: a HIT SK sorts ascending by default. We want highest exit
# velocity first → invert the velocity into a 4-digit zero-padded integer
# so a 117.8 mph hit (8821) sorts before a 100.0 mph hit (9000).
# Cap at 9999 (impossible velocity sentinel); clamp negatives to 9999 too.
_VELO_CAP = 9999


def hit_sk(launch_speed: float, game_pk: int, event_idx: int) -> str:
    """Build a HIT SK that sorts top-velocity-first under ascending Query."""
    inverted = _VELO_CAP - int(round(launch_speed * 10))
    if inverted < 0 or inverted > _VELO_CAP:
        inverted = _VELO_CAP
    return f"HIT#{inverted:04d}#{game_pk}#{event_idx}"


# ── Phase 5L (this commit) — team-aggregate stats ──────────────────────


def team_stats_pk(season: int) -> str:
    return f"TEAMSTATS#{season}"


def team_stats_sk(team_id: int) -> str:
    return f"TEAMSTATS#{team_id}"


# ── Phase 6 — career awards + cached AI compare commentary ─────────────


def awards_pk() -> str:
    return "AWARDS#GLOBAL"


def awards_sk(person_id: int) -> str:
    return f"AWARDS#{person_id}"


def ai_analysis_pk(kind: str, ids: list[int], season: int) -> str:
    """Stable cache key for /api/compare-analysis/<kind>?ids=...

    Sorts ids so [592450, 670541] and [670541, 592450] hit the same row.
    `kind` is "players" or "teams"; the season disambiguates so a 2027
    rerun of the same player pair regenerates rather than serving stale.
    """
    sorted_csv = "-".join(str(i) for i in sorted(ids))
    return f"AIANALYSIS#{kind}#{season}#{sorted_csv}"


def ai_analysis_sk() -> str:
    return "ANALYSIS"


# ── Phase 7 — Statcast / Baseball Savant per-player season summary ─────


def statcast_pk(season: int) -> str:
    return f"STATCAST#{season}"


def statcast_sk(person_id: int) -> str:
    return f"STATCAST#{person_id}"
