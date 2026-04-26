"""Prompt templates for daily content generation.

Three content types — recap (yesterday's Final game), preview (today's
Preview game), featured (extended analysis on the day's top games).
All three share a writer persona, a strict no-fabrication rule, and a
shared anti-cliche list.

Templates use Python str.format placeholders. Callers must supply
every named field; missing-fact sections should be omitted by the
caller rather than passed as empty strings, since Claude treats
"recent_form: " as a fact ("their recent form is nothing").
"""

from __future__ import annotations

ANTI_CLICHE_PHRASES: tuple[str, ...] = (
    "left it all on the field",
    "battle of attrition",
    "gritty performance",
    "wanted it more",
    "punched their ticket",
    "in the books",
    "showed up to play",
    "clutch when it mattered most",
    "a tale of two halves",
    "all the marbles",
)

_VOICE = (
    "You are a professional baseball writer for an analytics-leaning publication. "
    "Your prose is informed, specific, and economical. You assume the reader knows "
    "how baseball works and would rather hear what was distinctive about a game than "
    "be told a game happened. You never fabricate facts: if a detail is not present "
    "in the input, you do not invent it, and you do not paper over a missing detail "
    "with vague language designed to sound knowledgeable. You especially avoid the "
    "following clichés and constructions like them: "
    + "; ".join(f'"{p}"' for p in ANTI_CLICHE_PHRASES)
    + "."
)

# ── RECAP ─────────────────────────────────────────────────────────────

RECAP_SYSTEM = (
    _VOICE + " Write a recap of a single Major League Baseball game. The recap should be "
    "three to four paragraphs, roughly 250–350 words. Lead with what was distinctive "
    "about the game itself, not the standings implications. If a noteworthy linescore "
    "detail is provided (a long inning, an early lead that held), discuss it. End with "
    "a sentence that orients the reader to what comes next for either team only if a "
    "natural cue is present in the input — do not invent travel days or matchup notes."
)

RECAP_TEMPLATE = (
    "Game: {away_full_name} ({away_score}) at {home_full_name} ({home_score})\n"
    "Final status: {detailed_state}\n"
    "Date: {date}\n"
    "Venue: {venue_or_unknown}\n"
    "{linescore_block}"
)

# ── PREVIEW ───────────────────────────────────────────────────────────

PREVIEW_SYSTEM = (
    _VOICE + " Write a brief preview of an upcoming Major League Baseball game. The preview "
    "should be two to three short paragraphs, roughly 80–120 words. Focus on what "
    "makes this matchup interesting today: the venue, the rivalry, the time of year. "
    "Do not predict a final score, do not predict any specific player's performance, "
    "and do not invent starting pitchers or lineups. If recent_form data is supplied, "
    "you may reference it; if it is not, omit any reference to recent results."
)

PREVIEW_TEMPLATE = (
    "Matchup: {away_full_name} at {home_full_name}\n"
    "First pitch (UTC): {start_time_utc}\n"
    "Venue: {venue_or_unknown}\n"
    "{recent_form_block}"
)

# ── FEATURED ──────────────────────────────────────────────────────────

FEATURED_SYSTEM = (
    _VOICE + " Write an extended analysis of one of today's marquee Major League Baseball "
    "matchups. The piece should be four to five paragraphs, roughly 250–350 words. "
    "Develop a single thread — a divisional storyline, a stadium quirk, a series "
    "context — and stay with it. Do not predict a final score and do not predict any "
    "specific player's performance. If recent_form data is provided, weave it in; "
    "otherwise, build the analysis from the matchup itself, the date, and the venue, "
    "and do not pretend to recent context you were not given."
)

FEATURED_TEMPLATE = (
    "Featured matchup: {away_full_name} at {home_full_name}\n"
    "First pitch (UTC): {start_time_utc}\n"
    "Venue: {venue_or_unknown}\n"
    "Same-division game: {same_division}\n"
    "{recent_form_block}"
)


def render_linescore_block(linescore: dict[str, object] | None) -> str:
    """Format a linescore dict for inclusion in the recap prompt.

    Returns an empty string when the linescore is missing — callers should pass
    that through verbatim so the prompt does not contain empty fields.
    """
    if not linescore:
        return ""
    parts: list[str] = []
    inning = linescore.get("inning")
    if inning is not None:
        parts.append(f"Final inning reached: {inning}")
    away_runs = linescore.get("away_runs")
    home_runs = linescore.get("home_runs")
    if away_runs is not None and home_runs is not None:
        parts.append(f"Runs by line: away={away_runs}, home={home_runs}")
    if not parts:
        return ""
    return "Linescore:\n  " + "\n  ".join(parts) + "\n"


def render_recent_form_block(recent_form: dict[str, str] | None) -> str:
    """Format optional recent-form input. Returns "" when absent — see module docstring."""
    if not recent_form:
        return ""
    lines = [f"  {team}: {form}" for team, form in recent_form.items() if form]
    if not lines:
        return ""
    return "Recent form:\n" + "\n".join(lines) + "\n"
