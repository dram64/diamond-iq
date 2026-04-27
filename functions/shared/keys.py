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
