import { PlayerSilhouette } from '@/components/primitives/PlayerSilhouette';
import type { PitchMixEntry } from '@/types';

interface PitcherTabProps {
  pitcher: string;
  pitcherLine: string;
  mix: readonly PitchMixEntry[];
}

export function PitcherTab({ pitcher, pitcherLine, mix }: PitcherTabProps) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3.5">
        <PlayerSilhouette size={48} />
        <div>
          <div className="text-xl text-paper">{pitcher}</div>
          <div className="mono text-[11px] text-paper-4">Line: {pitcherLine}</div>
        </div>
      </div>
      <div className="kicker mb-2.5">Pitch mix tonight</div>
      {mix.map((p) => (
        <div key={p.name} className="mb-2.5">
          <div className="mono mb-1.5 flex justify-between text-[11px] text-paper-3">
            <span>
              <span className="text-paper">{p.name}</span> · {p.mph} mph
            </span>
            <span>
              {p.pct}% · <span className="text-paper-4">whiff {p.whiff}</span>
            </span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-[2px] bg-surface-3">
            <div
              className="h-full bg-accent-glow"
              // pct is 0-50-ish in the data; the original scales ×2 for visual impact.
              style={{ width: `${Math.min(100, p.pct * 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
