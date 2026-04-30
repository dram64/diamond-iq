/**
 * Helpers shared across the four /design-preview treatments. Each
 * treatment reads from the same ComparePlayer shape so the user can
 * judge them apples-to-apples against the same Judge-vs-Ohtani data.
 */

import type { ComparePlayer } from '@/types/compare';

export interface StatRef {
  /** Display label rendered on each treatment. */
  label: string;
  /** Stable token used for animation delays + ascending-stat lookup. */
  token: string;
  /** True when lower is better (ERA / xERA / WHIP / xBA-against). */
  ascending?: boolean;
  /** Pure value-extractor — pulls from the most informative source on
   *  the ComparePlayer (Statcast block first, then season aggregates). */
  pick: (p: ComparePlayer) => number | null;
  /** Display formatter. Returns "—" for null inputs. */
  format: (v: number | null) => string;
  /** Optional notional MLB league baseline used for the percentile-rings
   *  approximation (we don't have a real percentile API yet — see ADR 017
   *  Phase 8 percentile fallback note). Pair = (p10, p90) tail values. */
  percentileBaseline?: { p10: number; p90: number };
}

const toNum = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const fmtRate3 = (v: number | null): string => {
  if (v == null) return '—';
  return v < 1 ? v.toFixed(3).replace(/^0\./, '.') : v.toFixed(3);
};

const fmtFloat = (decimals: number) => (v: number | null): string =>
  v == null ? '—' : v.toFixed(decimals);

const fmtInt = (v: number | null): string => (v == null ? '—' : Math.round(v).toString());

const fmtPercent1 = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}%`);

// ── Hitter stats (used across all four treatments) ─────────────────────

export const HITTER_STATS: StatRef[] = [
  {
    label: 'Avg EV',
    token: 'avg_hit_speed',
    pick: (p) => toNum(p.statcast?.hitting?.avg_hit_speed),
    format: fmtFloat(1),
    percentileBaseline: { p10: 86, p90: 95 },
  },
  {
    label: 'Max EV',
    token: 'max_hit_speed',
    pick: (p) => toNum(p.statcast?.hitting?.max_hit_speed),
    format: fmtFloat(1),
    percentileBaseline: { p10: 105, p90: 116 },
  },
  {
    label: 'Barrel %',
    token: 'barrel_percent',
    pick: (p) => toNum(p.statcast?.hitting?.barrel_percent),
    format: fmtPercent1,
    percentileBaseline: { p10: 3, p90: 22 },
  },
  {
    label: 'Hard-hit %',
    token: 'ev95_percent',
    pick: (p) => toNum(p.statcast?.hitting?.ev95_percent),
    format: fmtPercent1,
    percentileBaseline: { p10: 28, p90: 55 },
  },
  {
    label: 'xwOBA',
    token: 'xwoba',
    pick: (p) => toNum(p.statcast?.hitting?.xwoba),
    format: fmtRate3,
    percentileBaseline: { p10: 0.28, p90: 0.42 },
  },
  {
    label: 'Sprint speed',
    token: 'sprint_speed',
    pick: (p) => toNum(p.statcast?.hitting?.sprint_speed),
    format: fmtFloat(1),
    percentileBaseline: { p10: 25.0, p90: 29.5 },
  },
  {
    label: 'OPS',
    token: 'ops',
    pick: (p) => toNum(p.hitting?.ops as number | string | undefined),
    format: fmtRate3,
    percentileBaseline: { p10: 0.65, p90: 0.95 },
  },
  {
    label: 'Sweet spot %',
    token: 'sweet_spot_percent',
    pick: (p) => toNum(p.statcast?.hitting?.sweet_spot_percent),
    format: fmtPercent1,
    percentileBaseline: { p10: 28, p90: 40 },
  },
];

// ── Pitcher stats (used by Stat Battles + Diverging Bars when both sides have them) ─

export const PITCHER_STATS: StatRef[] = [
  {
    label: 'Fastball velo',
    token: 'fastball_avg_speed',
    pick: (p) => toNum(p.statcast?.pitching?.fastball_avg_speed),
    format: fmtFloat(1),
    percentileBaseline: { p10: 91, p90: 98 },
  },
  {
    label: 'Fastball spin',
    token: 'fastball_avg_spin',
    pick: (p) => toNum(p.statcast?.pitching?.fastball_avg_spin),
    format: fmtInt,
    percentileBaseline: { p10: 2100, p90: 2500 },
  },
  {
    label: 'Whiff %',
    token: 'whiff_percent',
    pick: (p) => toNum(p.statcast?.pitching?.whiff_percent),
    format: fmtPercent1,
    percentileBaseline: { p10: 18, p90: 33 },
  },
  {
    label: 'xERA',
    token: 'xera',
    ascending: true,
    pick: (p) => toNum(p.statcast?.pitching?.xera),
    format: fmtFloat(2),
    percentileBaseline: { p10: 5.5, p90: 2.5 },
  },
];

/**
 * Approximate MLB-percentile rank from the (p10, p90) tail baseline.
 *
 * Linear between p10 and p90; clamps outside. NOT a real percentile
 * (would require querying every qualified player and sorting). Phase 8
 * ships this as the placeholder per the brief; Phase 8.5 will swap in
 * server-computed rank if the user picks the Rings treatment.
 *
 * Returns a value in [0, 100] where 100 = best, 0 = worst, accounting
 * for ascending stats (lower=better) where the baseline pair is reversed
 * (p10 is the high-bad value, p90 is the low-good value).
 */
export function approxPercentile(value: number | null, ref: StatRef): number | null {
  if (value == null) return null;
  const baseline = ref.percentileBaseline;
  if (!baseline) return null;
  const { p10, p90 } = baseline;
  // For ascending stats (xERA), our baseline encodes p10=high (bad), p90=low (good)
  // — so the same formula still produces "100 = best".
  const t = (value - p10) / (p90 - p10);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(clamped * 100);
}

/**
 * "Better-than-the-other" flag for binary winner emphasis. Returns
 * 'a' if player A's value is better, 'b' for B, 'tie' for equal,
 * null if either side is missing.
 */
export function pickWinner(
  a: number | null,
  b: number | null,
  ref: StatRef,
): 'a' | 'b' | 'tie' | null {
  if (a == null || b == null) return null;
  if (a === b) return 'tie';
  if (ref.ascending) return a < b ? 'a' : 'b';
  return a > b ? 'a' : 'b';
}
