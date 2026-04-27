/**
 * Stat-value formatting for the leaders / player views.
 *
 * Centralizes the per-stat presentation rules so a single change here is
 * picked up by every card. The MLB API returns rate stats already
 * formatted as ".300" / "3.50" strings; we pass those through. Decimal
 * values from Phase 5D (woba, ops_plus, fip) come back as numbers and
 * need explicit formatting.
 */

const RATE_STATS_PASS_THROUGH = new Set(['avg', 'obp', 'slg', 'ops', 'era', 'whip']);

const COUNTING_STATS = new Set(['hr', 'rbi', 'k', 'wins', 'saves', 'home_runs', 'strikeouts']);

/**
 * URL stat token → DynamoDB storage attribute name.
 *
 * Mirrors the backend's `_LEADER_STATS[group][stat].field` mapping for stats
 * where the URL token differs from the storage column. Tokens not in this
 * map (e.g. avg, era, whip, woba, fip, ops_plus) read back from the same
 * attribute name as the URL token.
 *
 * Single-source-of-truth note: the canonical mapping lives in
 * functions/api_players/routes/leaders.py. Frontend keeps a parallel copy
 * here so secondary-stat columns can read row[storageField] without an
 * extra round-trip. If the backend adds a new token-with-rename, this
 * map needs to be updated in lockstep — documented in ADR 012 Phase 5F.
 */
export const STAT_STORAGE_FIELD: Readonly<Record<string, string>> = {
  hr: 'home_runs',
  k: 'strikeouts',
};

/** Resolve the DynamoDB attribute name a leader-row value lives under. */
export function statStorageField(token: string): string {
  return STAT_STORAGE_FIELD[token] ?? token;
}

/** Strip a leading "0" before a decimal point so 0.399 renders as ".399". */
function strip_leading_zero(s: string): string {
  if (s.startsWith('0.')) return s.slice(1);
  if (s.startsWith('-0.')) return '-' + s.slice(2);
  return s;
}

export function formatStat(stat: string, value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';

  // Strings from the API are already display-formatted (".300", "3.50").
  // Pass through unchanged; no parse / re-render churn.
  if (typeof value === 'string') {
    return value || '—';
  }

  if (Number.isNaN(value)) return '—';

  // 5D-computed rate stats — Decimal-from-DynamoDB → number → 3dp .399 form.
  if (stat === 'woba') return strip_leading_zero(value.toFixed(3));

  // FIP renders to 2 decimals like ERA/WHIP for visual symmetry on the card.
  if (stat === 'fip') return value.toFixed(2);

  // OPS+ is a whole-number index where 100 = league average.
  if (stat === 'ops_plus') return Math.round(value).toString();

  // Counting stats — integer.
  if (COUNTING_STATS.has(stat)) return Math.round(value).toString();

  // Numeric form of a rate stat that the API would normally have stringified.
  // Round to 3 decimals and strip leading zero for display consistency.
  if (RATE_STATS_PASS_THROUGH.has(stat)) {
    return strip_leading_zero(value.toFixed(3));
  }

  // Fallback — render as-is.
  return value.toString();
}
