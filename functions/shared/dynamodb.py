"""DynamoDB read/write helpers for the games table.

Single-table design with a composite key:
    PK = "GAME#<yyyy-mm-dd>"
    SK = "GAME#<game_pk>"

The boto3 resource API does serialization for us — callers pass plain Python
types in and get plain Python types back (Decimals for any numeric attribute,
which we coerce back to int).
"""

from __future__ import annotations

import os
from typing import Any

import boto3

from .models import Game, Linescore, Team, game_to_dynamodb_item

_TABLE_NAME_ENV = "GAMES_TABLE_NAME"


def _resolve_table_name(override: str | None) -> str:
    if override is not None:
        return override
    name = os.environ.get(_TABLE_NAME_ENV)
    if not name:
        raise RuntimeError(
            f"{_TABLE_NAME_ENV} environment variable not set and no override provided"
        )
    return name


def _get_table(table_name: str | None):
    # Resolve the name first so a missing env var fails before any AWS SDK call.
    name = _resolve_table_name(table_name)
    return boto3.resource("dynamodb").Table(name)


def put_game(game: Game, table_name: str | None = None) -> None:
    table = _get_table(table_name)
    table.put_item(Item=game_to_dynamodb_item(game))


def get_game(game_pk: int, date: str, table_name: str | None = None) -> Game | None:
    table = _get_table(table_name)
    resp = table.get_item(Key={"PK": f"GAME#{date}", "SK": f"GAME#{game_pk}"})
    item = resp.get("Item")
    if not item:
        return None
    return _item_to_game(item)


def list_todays_games(date: str, table_name: str | None = None) -> list[Game]:
    table = _get_table(table_name)
    resp = table.query(
        KeyConditionExpression="PK = :pk",
        ExpressionAttributeValues={":pk": f"GAME#{date}"},
    )
    return [_item_to_game(it) for it in resp.get("Items", [])]


def _opt_int(d: dict[str, Any], key: str) -> int | None:
    v = d.get(key)
    return int(v) if v is not None else None


def _item_to_game(item: dict[str, Any]) -> Game:
    away = item["away_team"]
    home = item["home_team"]

    raw_ls = item.get("linescore")
    linescore: Linescore | None = None
    if raw_ls:
        linescore = Linescore(
            inning=_opt_int(raw_ls, "inning"),
            inning_half=raw_ls.get("inning_half"),
            balls=_opt_int(raw_ls, "balls"),
            strikes=_opt_int(raw_ls, "strikes"),
            outs=_opt_int(raw_ls, "outs"),
            away_runs=_opt_int(raw_ls, "away_runs"),
            home_runs=_opt_int(raw_ls, "home_runs"),
        )

    return Game(
        game_pk=int(item["game_pk"]),
        date=item["date"],
        status=item["status"],
        detailed_state=item["detailed_state"],
        away_team=Team(
            id=int(away["id"]),
            name=away["name"],
            abbreviation=away["abbreviation"],
        ),
        home_team=Team(
            id=int(home["id"]),
            name=home["name"],
            abbreviation=home["abbreviation"],
        ),
        away_score=int(item["away_score"]),
        home_score=int(item["home_score"]),
        venue=item.get("venue"),
        start_time_utc=item["start_time_utc"],
        linescore=linescore,
    )
