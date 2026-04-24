import type { Team } from '@/types';

interface WinProbStripProps {
  away: Team;
  home: Team;
  /** Home-team win probability, 0-100. */
  wp: number;
}

export function WinProbStrip({ away, home, wp }: WinProbStripProps) {
  const awayWp = 100 - wp;
  return (
    <div className="mono flex items-center gap-3 text-[11px] text-paper-4">
      <span>Win probability</span>
      <span className="font-semibold" style={{ color: away.color }}>
        {away.abbr} {awayWp}%
      </span>
      <div
        className="relative h-[3px] flex-1 overflow-hidden rounded-[2px]"
        style={{ background: home.color }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${awayWp}%`, background: away.color }}
        />
      </div>
      <span className="font-semibold" style={{ color: home.color }}>
        {wp}% {home.abbr}
      </span>
    </div>
  );
}
