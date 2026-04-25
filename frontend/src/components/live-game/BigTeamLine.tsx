import { TeamChip } from '@/components/primitives/TeamChip';
import type { AppTeam } from '@/types/app';

interface BigTeamLineProps {
  team: AppTeam;
  score: number;
  /** Hits — undefined when backend doesn't yet supply them. */
  hits?: number;
  /** Errors — undefined when backend doesn't yet supply them. */
  errors?: number;
  align: 'left' | 'right';
}

const EMDASH = '—';

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
      <TeamChip abbr={team.abbreviation} color={team.primaryColor} logoPath={team.logoPath} size={56} />
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-paper-4">
          {team.locationName || team.fullName}
        </span>
        <span className="text-[34px] font-semibold leading-none -tracking-[0.02em] text-paper">
          {team.teamName}
        </span>
        <span className="mono mt-0.5 text-[11px] text-paper-4">
          H{hits ?? EMDASH} · E{errors ?? EMDASH}
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
