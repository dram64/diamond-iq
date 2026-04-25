import type { AppTeam } from '@/types/app';

interface WinProbStripProps {
  away: AppTeam;
  home: AppTeam;
  /** Home-team win probability, 0-100. */
  wp: number;
}

const FALLBACK = '#27272a';

export function WinProbStrip({ away, home, wp }: WinProbStripProps) {
  const awayColor = away.primaryColor || FALLBACK;
  const homeColor = home.primaryColor || FALLBACK;
  const awayWp = 100 - wp;
  return (
    <div className="mono flex items-center gap-3 text-[11px] text-paper-4">
      <span>Win probability</span>
      <span className="font-semibold" style={{ color: awayColor }}>
        {away.abbreviation} {awayWp}%
      </span>
      <div
        className="relative h-[3px] flex-1 overflow-hidden rounded-[2px]"
        style={{ background: homeColor }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${awayWp}%`, background: awayColor }}
        />
      </div>
      <span className="font-semibold" style={{ color: homeColor }}>
        {wp}% {home.abbreviation}
      </span>
    </div>
  );
}
