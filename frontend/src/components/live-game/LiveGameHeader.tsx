import { BaseDiamond } from '@/components/primitives/BaseDiamond';
import { CountPips } from '@/components/primitives/CountPips';
import { Pill } from '@/components/primitives/Pill';
import { teamBy } from '@/mocks/teams';
import type { LiveGame } from '@/types';
import { BigTeamLine } from './BigTeamLine';

interface LiveGameHeaderProps {
  game: LiveGame;
}

export function LiveGameHeader({ game }: LiveGameHeaderProps) {
  const away = teamBy(game.away.id);
  const home = teamBy(game.home.id);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8 rounded-l border border-hairline bg-surface-1 px-8 py-6">
      <BigTeamLine
        team={away}
        score={game.away.score}
        hits={game.away.hits}
        errors={game.away.errors}
        align="left"
      />
      <div className="flex flex-col items-center gap-2.5">
        <Pill tone="live">
          <span className="live-dot" /> Live
        </Pill>
        <div className="text-[32px] font-semibold -tracking-[0.02em] text-paper">
          {game.half === 'top' ? 'Top' : 'Bot'}{' '}
          <span className="text-accent-glow">{game.inning}</span>
        </div>
        <BaseDiamond bases={game.bases} size={52} />
        <CountPips count={game.count} outs={game.outs} />
      </div>
      <BigTeamLine
        team={home}
        score={game.home.score}
        hits={game.home.hits}
        errors={game.home.errors}
        align="right"
      />
    </div>
  );
}
