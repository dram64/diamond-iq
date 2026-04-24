import { Card } from '@/components/primitives/Card';
import { PlayerSilhouette } from '@/components/primitives/PlayerSilhouette';
import { teamBy } from '@/mocks/teams';
import { formatBA } from '@/lib/format';
import type { ComparePreview } from '@/mocks/insights';
import type { ComparePreviewSide } from '@/types';

interface CompareStripProps {
  data: ComparePreview;
  max: Readonly<Record<string, number>>;
}

const formatStat = (key: string, v: number): string =>
  key === 'AVG' ? formatBA(v) : String(v);

export function CompareStrip({ data, max }: CompareStripProps) {
  const statKeys = Object.keys(data.a.stats);

  return (
    <Card>
      <div className="mb-4 grid grid-cols-2 gap-7 border-b border-hairline-strong pb-4">
        <CompareSide p={data.a} accent />
        <CompareSide p={data.b} />
      </div>
      <div className="flex flex-col gap-3">
        {statKeys.map((k) => {
          const vA = data.a.stats[k] ?? 0;
          const vB = data.b.stats[k] ?? 0;
          const m = max[k] ?? 1;
          const aLeads = vA >= vB;
          return (
            <div
              key={k}
              className="grid grid-cols-[1fr_60px_1fr] items-center gap-4"
            >
              {/* left side — mirrored bar */}
              <div className="flex items-center justify-end gap-2.5">
                <span
                  className={[
                    'mono text-[13px]',
                    aLeads ? 'font-bold text-accent' : 'font-medium text-paper-3',
                  ].join(' ')}
                >
                  {formatStat(k, vA)}
                </span>
                <div className="relative h-1.5 w-[180px] overflow-hidden rounded-s bg-surface-3">
                  <div
                    className={[
                      'absolute inset-y-0 right-0 transition-[width] duration-300',
                      aLeads ? 'bg-accent' : 'bg-paper-5',
                    ].join(' ')}
                    style={{ width: `${(vA / m) * 100}%` }}
                  />
                </div>
              </div>
              <span className="kicker text-center text-[10px]">{k}</span>
              <div className="flex items-center gap-2.5">
                <div className="relative h-1.5 w-[180px] overflow-hidden rounded-s bg-surface-3">
                  <div
                    className={[
                      'h-full transition-[width] duration-300',
                      !aLeads ? 'bg-accent' : 'bg-paper-5',
                    ].join(' ')}
                    style={{ width: `${(vB / m) * 100}%` }}
                  />
                </div>
                <span
                  className={[
                    'mono text-[13px]',
                    !aLeads ? 'font-bold text-accent' : 'font-medium text-paper-3',
                  ].join(' ')}
                >
                  {formatStat(k, vB)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CompareSide({
  p,
  accent = false,
}: {
  p: ComparePreviewSide;
  accent?: boolean;
}) {
  const t = teamBy(p.team);
  return (
    <div className="flex items-center gap-3.5">
      <PlayerSilhouette size={46} />
      <div className="flex flex-col gap-0.5">
        <div
          className={[
            'kicker',
            accent ? 'text-accent' : 'text-paper-4',
          ].join(' ')}
        >
          {t.city} · {p.pos}
        </div>
        <div className="text-lg font-bold -tracking-[0.01em] text-paper">
          {p.name}
        </div>
      </div>
    </div>
  );
}
