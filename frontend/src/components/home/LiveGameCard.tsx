import { Link } from 'react-router-dom';
import { BaseDiamond } from '@/components/primitives/BaseDiamond';
import { TeamChip } from '@/components/primitives/TeamChip';
import { Sparkline } from '@/components/charts/Sparkline';
import { WP_TRENDS } from '@/mocks/games';
import { teamBy } from '@/mocks/teams';
import type { InningHalf, LiveGame, Team } from '@/types';

interface LiveGameCardProps {
  game: LiveGame;
}

export function LiveGameCard({ game }: LiveGameCardProps) {
  const away = teamBy(game.away.id);
  const home = teamBy(game.home.id);
  const trend = WP_TRENDS[game.id] ?? [50, 50];
  const wpAway = 100 - game.wp;
  const wpHome = game.wp;

  return (
    <Link
      to={`/live/${game.id}`}
      className="group flex flex-col gap-3 rounded-l border border-hairline-strong bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-lg"
    >
      {/* live + inning */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-live">
          <span className="live-dot" /> Live
        </span>
        <span className="flex items-center gap-1 text-[11px] text-paper-3">
          <InningArrow half={game.half} />
          <span className="mono font-semibold">
            {game.half === 'top' ? 'Top' : 'Bot'} {game.inning}
          </span>
        </span>
      </div>

      {/* teams + scores */}
      <div className="flex flex-col gap-2">
        <GameTeamLine
          t={away}
          score={game.away.score}
          leading={game.away.score > game.home.score}
        />
        <GameTeamLine
          t={home}
          score={game.home.score}
          leading={game.home.score > game.away.score}
        />
      </div>

      {/* diamond + count + matchup */}
      <div className="flex items-center gap-3.5 border-y border-hairline py-2.5">
        <BaseDiamond bases={game.bases} size={36} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <CountMini label="B" value={game.count.balls} max={3} />
            <CountMini label="S" value={game.count.strikes} max={2} />
            <CountMini label="O" value={game.outs} max={2} red />
          </div>
          <div className="text-[11px] leading-snug text-paper-4">
            <span className="font-semibold text-paper-2">{game.batter}</span>
            {' vs '}
            <span className="font-semibold text-paper-2">{game.pitcher}</span>
          </div>
        </div>
      </div>

      {/* win probability */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.06em] text-paper-4">
            Win Prob
          </span>
          <Sparkline
            data={trend}
            width={90}
            height={14}
            stroke="#002d72"
            fill="rgba(0, 45, 114, 0.08)"
            showEnd={false}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={[
              'mono w-8 text-[11px]',
              wpAway > wpHome ? 'font-bold text-paper' : 'text-paper-4',
            ].join(' ')}
          >
            {wpAway}%
          </span>
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-s bg-surface-3">
            <div
              style={{ width: `${wpAway}%`, background: away.color, opacity: 0.9 }}
            />
            <div
              style={{ width: `${wpHome}%`, background: home.color, opacity: 0.9 }}
            />
          </div>
          <span
            className={[
              'mono w-8 text-right text-[11px]',
              wpHome > wpAway ? 'font-bold text-paper' : 'text-paper-4',
            ].join(' ')}
          >
            {wpHome}%
          </span>
        </div>
      </div>
    </Link>
  );
}

function InningArrow({ half }: { half: InningHalf }) {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" className="block" aria-hidden="true">
      {half === 'top' ? (
        <path d="M4 1 L7 6 L1 6 Z" fill="#4b5563" />
      ) : (
        <path d="M4 9 L7 4 L1 4 Z" fill="#4b5563" />
      )}
    </svg>
  );
}

function GameTeamLine({
  t,
  score,
  leading,
}: {
  t: Team;
  score: number;
  leading: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamChip id={t.id} size={26} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold -tracking-[0.01em] text-paper">
          {t.city}
        </div>
        <div className="mono text-[10.5px] text-paper-4">{t.rec}</div>
      </div>
      <div
        className={[
          'mono text-[26px] font-bold leading-none',
          leading ? 'text-paper' : 'text-paper-3',
        ].join(' ')}
      >
        {score}
      </div>
    </div>
  );
}

function CountMini({
  label,
  value,
  max,
  red,
}: {
  label: string;
  value: number;
  max: number;
  red?: boolean;
}) {
  const onClass = red ? 'bg-live' : 'bg-accent';
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-bold tracking-[0.04em] text-paper-4">
        {label}
      </span>
      <div className="flex gap-[3px]">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={[
              'h-1.5 w-1.5 rounded-full',
              i < value ? onClass : 'bg-[#e5e7eb]',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
