import { BaseDiamond } from '@/components/primitives/BaseDiamond';
import { CountPips } from '@/components/primitives/CountPips';
import { Pill } from '@/components/primitives/Pill';
import type { AppGame } from '@/types/app';
import { BigTeamLine } from './BigTeamLine';

interface LiveGameHeaderProps {
  game: AppGame;
}

const EMDASH = '—';

export function LiveGameHeader({ game }: LiveGameHeaderProps) {
  const inning = game.linescore?.inning;
  const half = game.linescore?.inningHalf;
  const balls = game.linescore?.balls ?? 0;
  const strikes = game.linescore?.strikes ?? 0;
  const outs = game.linescore?.outs ?? 0;

  const inningLabel =
    half === 'top' ? 'Top' : half === 'bot' ? 'Bot' : '';

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8 rounded-l border border-hairline bg-surface-1 px-8 py-6">
      <BigTeamLine team={game.away} score={game.awayScore} align="left" />
      <div className="flex flex-col items-center gap-2.5">
        {game.status === 'live' ? (
          <Pill tone="live">
            <span className="live-dot" /> Live
          </Pill>
        ) : (
          <Pill>{game.detailedState}</Pill>
        )}
        <div className="text-[32px] font-semibold -tracking-[0.02em] text-paper">
          {inningLabel}
          {inning != null ? (
            <>
              {' '}
              <span className="text-accent-glow">{inning}</span>
            </>
          ) : !inningLabel ? (
            EMDASH
          ) : null}
        </div>
        <BaseDiamond bases={game.bases} size={52} />
        <CountPips count={{ balls, strikes }} outs={outs} />
      </div>
      <BigTeamLine team={game.home} score={game.homeScore} align="right" />
    </div>
  );
}
