"""Tests for prompt templates."""

from __future__ import annotations

from shared.prompts import (
    ANTI_CLICHE_PHRASES,
    FEATURED_TEMPLATE,
    PREVIEW_TEMPLATE,
    RECAP_SYSTEM,
    RECAP_TEMPLATE,
    render_linescore_block,
    render_recent_form_block,
)


def test_recap_template_formats_with_full_inputs() -> None:
    rendered = RECAP_TEMPLATE.format(
        away_full_name="Boston Red Sox",
        home_full_name="New York Yankees",
        away_score=5,
        home_score=3,
        detailed_state="Final",
        date="2026-04-25",
        venue_or_unknown="Yankee Stadium",
        linescore_block=render_linescore_block({"inning": 9, "away_runs": 5, "home_runs": 3}),
    )
    assert "Boston Red Sox" in rendered
    assert "New York Yankees" in rendered
    assert "Final inning reached: 9" in rendered
    assert "{" not in rendered  # no unfilled placeholders


def test_preview_template_formats_with_no_recent_form() -> None:
    rendered = PREVIEW_TEMPLATE.format(
        away_full_name="Los Angeles Dodgers",
        home_full_name="San Diego Padres",
        start_time_utc="2026-04-26T22:10:00Z",
        venue_or_unknown="Petco Park",
        recent_form_block=render_recent_form_block(None),
    )
    assert "Los Angeles Dodgers" in rendered
    assert "Petco Park" in rendered
    # No empty "Recent form:" section when nothing supplied.
    assert "Recent form" not in rendered
    assert "{" not in rendered


def test_featured_template_includes_same_division_flag() -> None:
    rendered = FEATURED_TEMPLATE.format(
        away_full_name="Houston Astros",
        home_full_name="Seattle Mariners",
        start_time_utc="2026-04-26T22:10:00Z",
        venue_or_unknown="T-Mobile Park",
        same_division="yes",
        recent_form_block="",
    )
    assert "Same-division game: yes" in rendered
    assert "{" not in rendered


def test_recap_system_includes_anti_cliche_list() -> None:
    """The persona must explicitly tell Claude to avoid the banned phrases."""
    for phrase in ANTI_CLICHE_PHRASES[:3]:
        assert phrase in RECAP_SYSTEM
