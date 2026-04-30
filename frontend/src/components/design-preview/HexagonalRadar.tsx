/**
 * Treatment 4 — Hexagonal Radar.
 *
 * Single SVG hexagon. Six stat axes — avg EV, hard-hit %, barrel %,
 * xwOBA, sprint speed, OPS. Two overlapping translucent shapes:
 * Player A in leather brown (40 % opacity fill, full-opacity outer
 * stroke), Player B in muted gold. Stat label at each axis vertex.
 *
 * Hover an axis dot to highlight that axis with a tooltip showing
 * both player values.
 *
 * Two-way-player handling: hitter-only by design (per the brief).
 * Don't try to overlay Ohtani's pitcher profile here — different
 * stat scales make a single hex meaningless. A pitcher radar is a
 * separate Phase-8.5 surface if the user picks this treatment.
 */

import { useState } from 'react';

import type { ComparePlayer } from '@/types/compare';
import { HITTER_STATS, approxPercentile, type StatRef } from './stat-extract';

interface HexagonalRadarProps {
  a: ComparePlayer;
  b: ComparePlayer;
}

// Pick exactly six axes for the hex. Order = clockwise from top.
const RADAR_TOKENS = [
  'avg_hit_speed',
  'ev95_percent',
  'barrel_percent',
  'xwoba',
  'sprint_speed',
  'ops',
];

const RADAR_STATS: StatRef[] = RADAR_TOKENS.map((tok) => HITTER_STATS.find((s) => s.token === tok)!).filter(Boolean);

const SIZE = 360;
const CENTER = SIZE / 2;
const MAX_RADIUS = 130;

function vertex(index: number, fraction: number) {
  // 6 axes — start at top (-90°), step 60° each.
  const angleDeg = -90 + index * (360 / RADAR_STATS.length);
  const angleRad = (angleDeg * Math.PI) / 180;
  const r = MAX_RADIUS * fraction;
  return {
    x: CENTER + r * Math.cos(angleRad),
    y: CENTER + r * Math.sin(angleRad),
  };
}

function shapePoints(player: ComparePlayer): string {
  return RADAR_STATS.map((s, i) => {
    const v = s.pick(player);
    const pct = approxPercentile(v, s);
    const f = pct != null ? pct / 100 : 0;
    const { x, y } = vertex(i, Math.max(0.04, f)); // floor 4 % so a missing-data shape doesn't collapse to a dot
    return `${x},${y}`;
  }).join(' ');
}

export function HexagonalRadar({ a, b }: HexagonalRadarProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const aPath = shapePoints(a);
  const bPath = shapePoints(b);

  return (
    <div className="flex flex-col items-center gap-5 rounded-l border border-hairline-gold bg-surface-elevated p-6 shadow-md">
      <div className="flex items-center gap-6 text-[12.5px]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-accent-leather" />
          <span className="text-paper-cream-2">{a.metadata.full_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-accent-gold" />
          <span className="text-paper-cream-2">{b.metadata.full_name}</span>
        </div>
      </div>

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block"
        role="img"
        aria-label="Hexagonal radar comparison"
      >
        {/* Concentric guide rings at 25/50/75/100 % */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <polygon
            key={frac}
            points={RADAR_STATS.map((_, i) => {
              const { x, y } = vertex(i, frac);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="rgba(244, 234, 213, 0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Axis spokes */}
        {RADAR_STATS.map((_, i) => {
          const tip = vertex(i, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={tip.x}
              y2={tip.y}
              stroke="rgba(244, 234, 213, 0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Player A shape — leather */}
        <polygon
          points={aPath}
          fill="rgba(139, 90, 43, 0.40)"
          stroke="var(--accent-leather)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ animation: `fadein 400ms cubic-bezier(0.2, 0.8, 0.2, 1) 60ms both` }}
        />
        {/* Player B shape — gold */}
        <polygon
          points={bPath}
          fill="rgba(201, 169, 97, 0.40)"
          stroke="var(--accent-gold)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ animation: `fadein 400ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both` }}
        />

        {/* Axis hit-targets + labels */}
        {RADAR_STATS.map((s, i) => {
          const labelTip = vertex(i, 1.18);
          const dotTip = vertex(i, 1);
          const isHover = hoverIdx === i;
          return (
            <g
              key={s.token}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'crosshair' }}
            >
              <circle
                cx={dotTip.x}
                cy={dotTip.y}
                r={isHover ? 5 : 3}
                fill={isHover ? 'var(--accent-gold)' : 'var(--paper-gray-dim)'}
                style={{ transition: 'r 200ms ease-out, fill 200ms ease-out' }}
              />
              <text
                x={labelTip.x}
                y={labelTip.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="kicker"
                fill="var(--paper-gray)"
                fontSize={10}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip — text-only, lives below the chart so it doesn't depend
          on screen-coordinate hit detection. */}
      <div className="min-h-[42px] w-full rounded-m border border-hairline bg-surface-sunken px-4 py-2 text-center">
        {hoverIdx != null ? (
          <RadarHoverDetail a={a} b={b} stat={RADAR_STATS[hoverIdx]} />
        ) : (
          <span className="text-[11.5px] italic text-paper-gray-dim">
            Hover any axis dot for both players' values
          </span>
        )}
      </div>
    </div>
  );
}

function RadarHoverDetail({
  a,
  b,
  stat,
}: {
  a: ComparePlayer;
  b: ComparePlayer;
  stat: StatRef;
}) {
  const aVal = stat.pick(a);
  const bVal = stat.pick(b);
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1 text-[12px]">
      <span className="kicker text-paper-cream">{stat.label}</span>
      <span className="text-paper-gray">
        {a.metadata.full_name}:{' '}
        <span className="mono font-bold text-accent-leather-glow">{stat.format(aVal)}</span>
      </span>
      <span className="text-paper-gray">
        {b.metadata.full_name}:{' '}
        <span className="mono font-bold text-accent-gold">{stat.format(bVal)}</span>
      </span>
    </div>
  );
}
