import { TeamChip } from '@/components/primitives/TeamChip';
import type { Team } from '@/types';

interface BigTeamLineProps {
  team: Team;
  score: number;
  hits: number;
  errors: number;
  align: 'left' | 'right';
}

/** Large 56-px-chip team block with big score used in the live-game hero. */
export function BigTeamLine({ team, score, hits, errors, align }: BigTeamLineProps) {
  const right = align === 'right';
  return (
    <div
      className={[
        'flex items-center gap-5',
        right ? 'flex-row-reverse text-right' : 'text-left',
      ].join(' ')}
    >
      <TeamChip id={team.id} size={56} />
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-paper-4">
          {team.city}
        </span>
        <span className="text-[34px] font-semibold leading-none -tracking-[0.02em] text-paper">
          {team.name}
        </span>
        <span className="mono mt-0.5 text-[11px] text-paper-4">
          {team.rec} · H{hits} · E{errors}
        </span>
      </div>
      <span
        className={[
          'mono text-[74px] font-medium leading-none text-paper',
          right ? 'mr-auto' : 'ml-auto',
        ].join(' ')}
      >
        {score}
      </span>
    </div>
  );
}
