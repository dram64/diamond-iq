/**
 * Curated player-comparison matchups for the home-page CompareStrip.
 *
 * v1 picker mechanism: a small list of pre-selected pairs the user can
 * cycle through. Search-based selection (a /api/players/search?q=...
 * endpoint plus a typeahead) is a Phase 5K+ enhancement — out of scope
 * here.
 *
 * Selection criteria:
 *   - Both players appear in the qualified-player pool the daily
 *     ingest writes to STATS#<season>#<group> (otherwise the
 *     comparison renders the "Insufficient season data" fallback).
 *   - All four matchups are TYPE-MATCHED (hitter-vs-hitter or
 *     pitcher-vs-pitcher) so the "incomparable types" fallback is
 *     never the default render path.
 *   - Mix of recognizable veterans, breakout candidates, and AL/NL
 *     coverage so the rotation feels editorially curated.
 *
 * Maintenance note: matchup IDs reference real MLB person IDs that
 * may drop out of the qualified pool mid-season (injury, demotion,
 * trade). The CompareStrip component handles missing data
 * gracefully — a stale matchup just shows the fallback message
 * instead of crashing — but the list should be reviewed
 * periodically and rotated when a featured player goes cold.
 * Documented in ADR 012 Phase 5H amendment.
 */

export interface FeaturedComparison {
  /** Stable URL-friendly slug. */
  id: string;
  /** Tab label in the picker. */
  title: string;
  /** Two MLB person IDs. The API supports up to 4, but v1 always uses 2. */
  playerIds: readonly [number, number];
  /** Editorial blurb shown beneath the picker (kept short). */
  subtitle: string;
}

export const FEATURED_COMPARISONS: readonly FeaturedComparison[] = [
  {
    // Top-3 wOBA matchup. Judge is the AL East face; Alvarez has the
    // highest wOBA in the qualified pool early-season 2026.
    id: 'judge-alvarez',
    title: 'Judge vs Alvarez',
    playerIds: [592450, 670541],
    subtitle: 'AL East vs AL West · top-3 wOBA',
  },
  {
    // Veterans head-to-head. Trout cracks the top-10 wOBA list; Olson
    // is a perennial cleanup-spot anchor in Atlanta.
    id: 'trout-olson',
    title: 'Trout vs Olson',
    playerIds: [545361, 621566],
    subtitle: 'Two-way veteran vs NL East 1B anchor',
  },
  {
    // Pitcher matchup: established left-handed ace vs the breakout
    // closer leading the qualified ERA list.
    id: 'sale-soriano',
    title: 'Sale vs Soriano',
    playerIds: [519242, 667755],
    subtitle: 'Veteran ace vs early-season ERA leader',
  },
  {
    // Two breakout starters in the top 5 ERA. Both 2024-25 prospects
    // making their case for full-season rotation spots.
    id: 'schlittler-wrobleski',
    title: 'Schlittler vs Wrobleski',
    playerIds: [693645, 680736],
    subtitle: 'Breakout-prospect rotation arms',
  },
];

/** Look up a featured matchup by id. Returns undefined if not found. */
export function getFeaturedComparison(id: string): FeaturedComparison | undefined {
  return FEATURED_COMPARISONS.find((m) => m.id === id);
}
