import { PlayerSilhouette } from '@/components/primitives/PlayerSilhouette';
import type { BatterSide, MatchupStatRow } from '@/types';

interface MatchupTabProps {
  batter: string;
  pitcher: string;
  batterSide: BatterSide;
  batterDetail: string;
  pitcherRole: string;
  pitcherDetail: string;
  stats: readonly MatchupStatRow[];
}

export function MatchupTab({
  batter,
  pitcher,
  batterSide,
  batterDetail,
  pitcherRole,
  pitcherDetail,
  stats,
}: MatchupTabProps) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-[1fr_60px_1fr] items-center gap-3">
        <MatchupSide
          name={batter}
          role={`Batter · ${batterSide === 'L' ? 'LHB' : 'RHB'}`}
          detail={batterDetail}
          align="left"
        />
        <div className="text-center text-xl italic text-paper-4">vs</div>
        <MatchupSide
          name={pitcher}
          role={pitcherRole}
          detail={pitcherDetail}
          align="right"
        />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] border-t border-hairline">
        {stats.map((row, i) => {
          const isLast = i === stats.length - 1;
          const cellBorder = isLast ? '' : 'border-b border-hairline';
          return (
            <div key={row.label} className="contents">
              <div
                className={`mono px-4 py-2.5 text-right text-[12px] text-paper-2 ${cellBorder}`}
              >
                {row.batter}
              </div>
              <div
                className={`px-3 py-2.5 text-center text-[10px] uppercase tracking-[0.1em] text-paper-5 ${cellBorder}`}
              >
                {row.label}
              </div>
              <div
                className={`mono px-4 py-2.5 text-left text-[12px] text-paper-2 ${cellBorder}`}
              >
                {row.pitcher}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchupSide({
  name,
  role,
  detail,
  align,
}: {
  name: string;
  role: string;
  detail: string;
  align: 'left' | 'right';
}) {
  const right = align === 'right';
  return (
    <div
      className={[
        'flex items-center gap-3',
        right ? 'flex-row-reverse text-right' : '',
      ].join(' ')}
    >
      <PlayerSilhouette size={42} />
      <div className="flex flex-col gap-0.5">
        <span className="kicker text-[9.5px]">{role}</span>
        <span className="text-[17px] -tracking-[0.01em] text-paper">{name}</span>
        <span className="mono text-[10.5px] text-paper-4">{detail}</span>
      </div>
    </div>
  );
}
