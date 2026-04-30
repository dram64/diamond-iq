/**
 * Treatment 1 — Percentile Rings.
 *
 * Each stat renders as a circular SVG gauge per player. Ring fill
 * tracks an approximate MLB-league percentile (placeholder math —
 * see ADR 017 Phase 8 percentile-fallback note). Side-by-side rings,
 * gold for the higher-percentile player, cool gray for the lower.
 * Title attribute on each ring surfaces the underlying stat value
 * + percentile number on hover.
 *
 * Two-way-player handling: Ohtani's pitcher metrics aren't shown
 * here — Rings are scoped to the eight hero hitter stats (see
 * HITTER_STATS in stat-extract.ts). If a treatment-level future
 * iteration wants pitcher rings, render them in a separate row
 * card so the percentile baseline doesn't get mixed.
 */

import type { ComparePlayer } from '@/types/compare';
import { HITTER_STATS, approxPercentile, pickWinner, type StatRef } from './stat-extract';

interface PercentileRingsProps {
  a: ComparePlayer;
  b: ComparePlayer;
}

const RING_DIAM = 96;
const RING_RADIUS = 42;
const RING_CIRC = 2 * Math.PI * RING_RADIUS; // ~263.9

export function PercentileRings({ a, b }: PercentileRingsProps) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
      {HITTER_STATS.map((s, i) => {
        const aVal = s.pick(a);
        const bVal = s.pick(b);
        const aPct = approxPercentile(aVal, s);
        const bPct = approxPercentile(bVal, s);
        const winner = pickWinner(aVal, bVal, s);

        return (
          <div
            key={s.token}
            className="flex flex-col items-center gap-3 rounded-l border border-hairline-gold bg-surface-elevated p-4 shadow-md"
            style={{
              animation: `fadein 200ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 50}ms both`,
            }}
          >
            <span className="kicker text-paper-gray">{s.label}</span>
            <div className="flex items-center gap-3">
              <RingDisplay
                player={a}
                value={aVal}
                percentile={aPct}
                stat={s}
                isWinner={winner === 'a'}
              />
              <RingDisplay
                player={b}
                value={bVal}
                percentile={bPct}
                stat={s}
                isWinner={winner === 'b'}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface RingDisplayProps {
  player: ComparePlayer;
  value: number | null;
  percentile: number | null;
  stat: StatRef;
  isWinner: boolean;
}

function RingDisplay({ player, value, percentile, stat, isWinner }: RingDisplayProps) {
  const fillFraction = percentile != null ? percentile / 100 : 0;
  const dashOffset = RING_CIRC * (1 - fillFraction);
  const stroke = isWinner ? 'var(--accent-gold)' : 'var(--paper-gray-dim)';
  const valueColor = isWinner ? 'text-accent-gold' : 'text-paper-gray';
  const valueWeight = isWinner ? 'font-bold' : 'font-medium';
  const initials = player.metadata.full_name
    ?.split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="relative flex flex-col items-center"
      title={
        value == null
          ? `${stat.label}: no data for ${player.metadata.full_name}`
          : `${stat.label}: ${stat.format(value)} (≈ p${percentile ?? '—'})`
      }
    >
      <svg width={RING_DIAM} height={RING_DIAM} viewBox={`0 0 ${RING_DIAM} ${RING_DIAM}`}>
        <circle
          cx={RING_DIAM / 2}
          cy={RING_DIAM / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(244, 234, 213, 0.06)"
          strokeWidth={6}
        />
        <circle
          cx={RING_DIAM / 2}
          cy={RING_DIAM / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_DIAM / 2} ${RING_DIAM / 2})`}
          style={{
            transition: 'stroke-dashoffset 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={['mono', 'text-[15px]', valueWeight, valueColor].join(' ')}>
          {stat.format(value)}
        </span>
        <span className="mono text-[9.5px] text-paper-gray-dim">
          {percentile != null ? `p${percentile}` : '—'}
        </span>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-[0.06em] text-paper-gray-dim">
        {initials}
      </span>
    </div>
  );
}
