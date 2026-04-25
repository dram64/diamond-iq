import { Link } from 'react-router-dom';
import { TeamChip } from '@/components/primitives/TeamChip';
import { teamBy } from '@/mocks/teams';
import type { TeamGridEntry } from '@/types';

interface TeamGridCardProps {
  entry: TeamGridEntry;
}

export function TeamGridCard({ entry }: TeamGridCardProps) {
  const team = teamBy(entry.id);
  const streakIsWin = entry.strk.startsWith('W');

  return (
    <Link
      to={`/teams/${entry.id}`}
      className="group flex flex-col gap-2.5 rounded-m border border-hairline-strong bg-white p-3.5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-2.5">
        <TeamChip abbr={team.abbr} color={team.color} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold -tracking-[0.01em] text-paper">
            {team.city}
          </div>
          <div className="mono text-[10.5px] text-paper-4">{team.name}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-hairline pt-2">
        <MiniStat label="Record" value={entry.rec} />
        <MiniStat label="Last 10" value={entry.l10} />
        <MiniStat
          label="Streak"
          value={entry.strk}
          tone={streakIsWin ? 'good' : 'bad'}
        />
        <MiniStat
          label="Playoff"
          value={`${entry.odds.toFixed(1)}%`}
          tone={entry.odds > 60 ? 'accent' : 'default'}
        />
      </div>
      <div className="mt-0.5 h-[3px] overflow-hidden rounded-s bg-surface-3">
        <div
          className={[
            'h-full',
            entry.odds > 60 ? 'bg-accent' : 'bg-paper-5',
          ].join(' ')}
          style={{ width: `${entry.odds}%` }}
        />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'bad' | 'accent';
}) {
  const color =
    tone === 'good'
      ? 'text-good'
      : tone === 'bad'
        ? 'text-bad'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-paper-2';
  return (
    <div>
      <div className="kicker mb-0.5 text-[8.5px]">{label}</div>
      <div className={`mono text-[12.5px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}
