/**
 * Treatment 2 — Diverging Bars.
 *
 * Each stat row has a center axis with the stat label. Player A's
 * bar grows leftward, Player B's bar grows rightward. Bar length
 * scales to the row's max value with 5 % headroom (matches the
 * existing PlayerComparePage pattern). The longer bar gets the
 * gold gradient + subtle glow; the shorter bar is leather brown.
 *
 * Two-way-player handling: only stats where BOTH players have
 * values are rendered. Pitcher stats are filtered out for a
 * Judge-vs-Ohtani pairing because Judge has no pitching block.
 */

import type { ComparePlayer } from '@/types/compare';
import {
  HITTER_STATS,
  PITCHER_STATS,
  pickWinner,
  type StatRef,
} from './stat-extract';

interface DivergingBarsProps {
  a: ComparePlayer;
  b: ComparePlayer;
}

export function DivergingBars({ a, b }: DivergingBarsProps) {
  // Filter to stats where BOTH players have values. Pitcher stats fall
  // out automatically when one player isn't a pitcher.
  const candidates = [...HITTER_STATS, ...PITCHER_STATS];
  const bothPresent = candidates.filter(
    (s) => s.pick(a) != null && s.pick(b) != null,
  );

  return (
    <div className="flex flex-col gap-2.5 rounded-l border border-hairline-gold bg-surface-elevated p-5 shadow-md">
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
        <div className="text-right">
          <div className="kicker text-paper-gray">{a.metadata.full_name}</div>
        </div>
        <div className="kicker text-accent-gold">vs</div>
        <div className="text-left">
          <div className="kicker text-paper-gray">{b.metadata.full_name}</div>
        </div>
      </div>

      {bothPresent.map((s, i) => (
        <DivergingBar key={s.token} a={a} b={b} stat={s} delayMs={i * 40} />
      ))}

      {bothPresent.length === 0 && (
        <div className="px-2 py-6 text-center text-[12.5px] text-paper-gray">
          No stats where both players have values.
        </div>
      )}
    </div>
  );
}

function DivergingBar({
  a,
  b,
  stat,
  delayMs,
}: {
  a: ComparePlayer;
  b: ComparePlayer;
  stat: StatRef;
  delayMs: number;
}) {
  const aVal = stat.pick(a) as number;
  const bVal = stat.pick(b) as number;
  const max = Math.max(aVal, bVal) * 1.05 || 1;
  // For ascending stats, "longer fill" should flip — best (lowest) gets
  // the longest visual length. We compute fill on (max - val) instead.
  const aFill = stat.ascending ? Math.max(0, max - aVal) / max : aVal / max;
  const bFill = stat.ascending ? Math.max(0, max - bVal) / max : bVal / max;
  const winner = pickWinner(aVal, bVal, stat);
  const aGoldClass =
    winner === 'a'
      ? 'bg-accent-gold shadow-gold'
      : 'bg-accent-leather/70';
  const bGoldClass =
    winner === 'b'
      ? 'bg-accent-gold shadow-gold'
      : 'bg-accent-leather/70';

  return (
    <div
      className="grid grid-cols-[1fr_120px_1fr] items-center gap-3"
      style={{ animation: `fadein 200ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms both` }}
    >
      {/* A side — bar grows leftward */}
      <div className="flex items-center justify-end gap-3">
        <span
          className={[
            'mono text-[13px]',
            winner === 'a' ? 'font-bold text-accent-gold' : 'font-medium text-paper-gray',
          ].join(' ')}
        >
          {stat.format(aVal)}
        </span>
        <div className="relative h-2.5 w-full max-w-[260px] overflow-hidden rounded-s bg-surface-sunken">
          <div
            className={[
              'absolute inset-y-0 right-0 origin-right rounded-s transition-[width] duration-300 ease-out',
              aGoldClass,
            ].join(' ')}
            style={{
              width: `${aFill * 100}%`,
              animation: `bargrow 400ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms both`,
              transformOrigin: 'right',
            }}
          />
        </div>
      </div>

      {/* Center label */}
      <div className="flex flex-col items-center">
        <span className="kicker text-[10px] text-paper-cream-2">{stat.label}</span>
      </div>

      {/* B side — bar grows rightward */}
      <div className="flex items-center gap-3">
        <div className="relative h-2.5 w-full max-w-[260px] overflow-hidden rounded-s bg-surface-sunken">
          <div
            className={[
              'h-full origin-left rounded-s transition-[width] duration-300 ease-out',
              bGoldClass,
            ].join(' ')}
            style={{
              width: `${bFill * 100}%`,
              animation: `bargrow 400ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms both`,
              transformOrigin: 'left',
            }}
          />
        </div>
        <span
          className={[
            'mono text-[13px]',
            winner === 'b' ? 'font-bold text-accent-gold' : 'font-medium text-paper-gray',
          ].join(' ')}
        >
          {stat.format(bVal)}
        </span>
      </div>
    </div>
  );
}
