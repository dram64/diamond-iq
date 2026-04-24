import { TeamChip } from '@/components/primitives/TeamChip';
import { teamBy } from '@/mocks/teams';
import type { ScheduledGame } from '@/types';

interface ScheduleStripProps {
  games: readonly ScheduledGame[];
}

const TIMES = ['7:05 PM', '7:10 PM', '7:35 PM', '8:05 PM', '9:10 PM', '10:10 PM'] as const;

const PROBABLES: readonly (readonly [string, string])[] = [
  ['L. Whitfield', 'E. Caruana'],
  ['C. Madani', 'T. Nakashima'],
  ['R. Solberg', 'K. Zaragoza'],
  ['S. Ikeda', 'H. Abara'],
  ['M. Solis', 'P. Lindqvist'],
  ['D. Osei', 'F. Varga'],
];

/**
 * The mock slate only has one scheduled game; the strip pads to 6 cards by
 * repeating it so the UI shows a full row.
 */
export function ScheduleStrip({ games }: ScheduleStripProps) {
  if (games.length === 0) return null;
  const padded = Array.from({ length: 6 }, (_, i) => games[i % games.length]!);

  return (
    <div className="grid grid-cols-6 gap-2.5">
      {padded.map((g, i) => {
        const away = teamBy(g.away.id);
        const home = teamBy(g.home.id);
        const prob = PROBABLES[i] ?? ['TBD', 'TBD'];
        return (
          <article
            key={i}
            className="flex flex-col gap-2.5 rounded-m border border-hairline-strong bg-white p-3 shadow-sm"
          >
            <div className="mono text-[11px] font-bold text-paper-2">{TIMES[i]}</div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <TeamChip id={away.id} size={22} />
                <span className="text-[13px] font-semibold">{away.abbr}</span>
              </div>
              <div className="text-[9px] tracking-[0.08em] text-paper-5">@</div>
              <div className="flex items-center gap-2">
                <TeamChip id={home.id} size={22} />
                <span className="text-[13px] font-semibold">{home.abbr}</span>
              </div>
            </div>
            <div className="border-t border-hairline pt-2 text-[10px] leading-tight text-paper-4">
              <div>{prob[0]}</div>
              <div>{prob[1]}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
