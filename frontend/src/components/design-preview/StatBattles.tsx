/**
 * Treatment 3 — Stat Battles (card grid).
 *
 * Each stat is a small card. Card shows:
 *   - Stat label at top (kicker style)
 *   - Both player values stacked vertically: winner big + gold + glowing,
 *     loser smaller + cool gray + dimmed
 *   - A small leather-brown badge in the corner showing the numeric gap
 *     ("+5.2 mph", "+0.045", etc.)
 *
 * Two-way-player handling — chosen approach: render the card, but mark
 * the missing side with a "no comparison" hint instead of dropping the
 * card. Keeps grid alignment stable so a Judge-vs-Ohtani comparison
 * shows the same number of cells regardless of which sub-blocks each
 * player has. The alternative — filtering to "both present" — is
 * already covered by Treatment 2 (Diverging Bars), so the two
 * treatments stay distinct in their handling of asymmetric data.
 */

import type { ComparePlayer } from '@/types/compare';
import { HITTER_STATS, PITCHER_STATS, pickWinner, type StatRef } from './stat-extract';

interface StatBattlesProps {
  a: ComparePlayer;
  b: ComparePlayer;
}

export function StatBattles({ a, b }: StatBattlesProps) {
  // Show all 8 hitter stats + the 4 pitcher stats. The pitcher cards
  // surface the "no comparison" pattern when one side is hitter-only.
  const stats = [...HITTER_STATS, ...PITCHER_STATS];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((s, i) => (
        <StatCard key={s.token} a={a} b={b} stat={s} delayMs={i * 40} />
      ))}
    </div>
  );
}

function StatCard({
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
  const aVal = stat.pick(a);
  const bVal = stat.pick(b);
  const winner = pickWinner(aVal, bVal, stat);
  const gap =
    aVal != null && bVal != null
      ? stat.ascending
        ? Math.abs(bVal - aVal)
        : Math.abs(aVal - bVal)
      : null;

  const gapText =
    gap != null
      ? // Use the same display formatter so units carry through.
        `Δ ${stat.format(gap).replace(/^—$/, '0')}`
      : null;

  return (
    <div
      className="relative overflow-hidden rounded-l border border-hairline-gold bg-surface-elevated p-4 shadow-md transition-shadow duration-200 ease-out hover:shadow-gold"
      style={{
        animation: `fadein 200ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms both`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="kicker text-paper-gray">{stat.label}</span>
        {gapText && (
          <span className="rounded-full border border-accent-leather/40 bg-accent-leather/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-accent-leather-glow">
            {gapText}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <CardSide
          name={a.metadata.full_name}
          value={aVal}
          stat={stat}
          isWinner={winner === 'a'}
          isOnlyOneWithData={aVal != null && bVal == null}
        />
        <div className="border-t border-hairline" />
        <CardSide
          name={b.metadata.full_name}
          value={bVal}
          stat={stat}
          isWinner={winner === 'b'}
          isOnlyOneWithData={bVal != null && aVal == null}
        />
      </div>
    </div>
  );
}

function CardSide({
  name,
  value,
  stat,
  isWinner,
  isOnlyOneWithData,
}: {
  name: string;
  value: number | null;
  stat: StatRef;
  isWinner: boolean;
  isOnlyOneWithData: boolean;
}) {
  if (value == null) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-paper-gray-dim">{name}</span>
        <span className="text-[10.5px] italic text-paper-gray-dim">no comparison</span>
      </div>
    );
  }
  const sizeClass = isWinner ? 'text-[36px] leading-none' : 'text-[18px]';
  const colorClass = isWinner ? 'text-accent-gold' : 'text-paper-gray';
  const glow = isWinner ? 'drop-shadow-[0_0_12px_rgba(201,169,97,0.35)]' : '';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-paper-cream-2">{name}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={[
            'mono font-bold transition-colors',
            sizeClass,
            colorClass,
            glow,
            isOnlyOneWithData ? 'opacity-95' : '',
          ].join(' ')}
        >
          {stat.format(value)}
        </span>
      </div>
    </div>
  );
}
