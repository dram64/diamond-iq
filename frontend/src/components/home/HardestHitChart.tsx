import { Card } from '@/components/primitives/Card';
import { TeamChip } from '@/components/primitives/TeamChip';
import type { HardestHitEntry } from '@/types';

interface HardestHitChartProps {
  data: readonly HardestHitEntry[];
}

/** Horizontal bar chart of exit velocities for the day's hardest-hit balls. */
export function HardestHitChart({ data }: HardestHitChartProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.mph));
  const min = 105;

  return (
    <Card>
      <div className="mb-2.5 grid grid-cols-[160px_1fr_90px_70px] items-center gap-3 border-b border-hairline-strong pb-2.5">
        <span className="kicker text-[9px]">Hitter</span>
        <span className="kicker text-[9px]">Exit velocity (mph)</span>
        <span className="kicker text-right text-[9px]">Result</span>
        <span className="kicker text-right text-[9px]">MPH</span>
      </div>
      {data.map((d, i) => {
        const pct = ((d.mph - min) / (max - min)) * 100;
        const opacity = 0.35 + 0.65 * (1 - i / data.length);
        return (
          <div
            key={d.name}
            className="grid grid-cols-[160px_1fr_90px_70px] items-center gap-3 border-b border-hairline py-2.5 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <TeamChip id={d.team} size={18} />
              <span className="text-[13px] font-medium text-paper">{d.name}</span>
            </div>
            <div className="relative h-4 overflow-hidden rounded-s bg-surface-3">
              <div
                className={[
                  'h-full transition-[width] duration-300',
                  i === 0 ? 'bg-accent' : 'bg-accent-glow',
                ].join(' ')}
                style={{ width: `${pct}%`, opacity }}
              />
            </div>
            <span className="text-right text-[11px] text-paper-4">{d.result}</span>
            <span className="mono text-right text-[13px] font-semibold text-paper">
              {d.mph.toFixed(1)}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
