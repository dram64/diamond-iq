import { TeamChip } from '@/components/primitives/TeamChip';
import { teamBy } from '@/mocks/teams';
import type { FinalGame, Team } from '@/types';

interface FinalsListProps {
  games: readonly FinalGame[];
}

export function FinalsList({ games }: FinalsListProps) {
  const rows = games.slice(0, 5);

  return (
    <div className="grid grid-cols-5 gap-2.5">
      {rows.map((g) => {
        const away = teamBy(g.away.id);
        const home = teamBy(g.home.id);
        const awayWon = g.away.score > g.home.score;
        return (
          <article
            key={g.id}
            className="flex flex-col gap-2 rounded-m border border-hairline-strong bg-white p-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-paper-4">
                {g.note ?? 'Final'}
              </span>
              <button
                type="button"
                className="bg-transparent p-0 text-[11px] font-semibold text-accent hover:text-accent-glow"
              >
                Box →
              </button>
            </div>
            <FinalTeamLine t={away} score={g.away.score} won={awayWon} />
            <FinalTeamLine t={home} score={g.home.score} won={!awayWon} />
          </article>
        );
      })}
    </div>
  );
}

function FinalTeamLine({
  t,
  score,
  won,
}: {
  t: Team;
  score: number;
  won: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <TeamChip id={t.id} size={20} />
      <span
        className={[
          'flex-1 text-[13px]',
          won ? 'font-bold text-paper' : 'font-medium text-paper-4',
        ].join(' ')}
      >
        {t.city}
      </span>
      <span
        className={[
          'mono text-base font-bold',
          won ? 'text-paper' : 'text-paper-4',
        ].join(' ')}
      >
        {score}
      </span>
    </div>
  );
}
