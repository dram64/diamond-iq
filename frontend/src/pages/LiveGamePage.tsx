import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AnalystColumn } from '@/components/primitives/AnalystColumn';
import { Card } from '@/components/primitives/Card';
import { SectionHeaderSmall } from '@/components/primitives/SectionHeaderSmall';
import { PitchList } from '@/components/charts/PitchList';
import { StrikeZone } from '@/components/charts/StrikeZone';
import { LiveGameHeader } from '@/components/live-game/LiveGameHeader';
import { MatchupTab } from '@/components/live-game/MatchupTab';
import { PitcherTab } from '@/components/live-game/PitcherTab';
import { PlayByPlay } from '@/components/live-game/PlayByPlay';
import { WinProbStrip } from '@/components/live-game/WinProbStrip';
import { liveGames } from '@/mocks/games';
import { liveGameDetail } from '@/mocks/liveGame';
import { teamBy } from '@/mocks/teams';

type TabId = 'plays' | 'matchup' | 'pitcher';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'plays',   label: 'Play-by-play' },
  { id: 'matchup', label: 'Matchup' },
  { id: 'pitcher', label: 'Pitcher' },
];

export function LiveGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [tab, setTab] = useState<TabId>('plays');

  const game = liveGames().find((g) => g.id === gameId);
  if (!game) return <Navigate to="/" replace />;

  const away = teamBy(game.away.id);
  const home = teamBy(game.home.id);
  const detail = liveGameDetail(game.id);

  return (
    <div>
      <LiveGameHeader game={game} />

      <div className="mx-0.5 mb-8 mt-3.5">
        <WinProbStrip away={away} home={home} wp={game.wp} />
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_1fr] items-start gap-5">
        {/* LEFT: strike zone + pitch list */}
        <Card>
          <SectionHeaderSmall kicker="Current at-bat" title={game.batter} />
          <div className="mt-1.5 flex flex-col items-center">
            <StrikeZone pitches={detail.pitches} batter={detail.batterSide} />
          </div>
          <div className="mt-3.5 border-t border-hairline pt-3.5">
            <PitchList pitches={detail.pitches} />
          </div>
        </Card>

        {/* CENTER: tabs */}
        <Card flush>
          <div
            role="tablist"
            aria-label="Live game detail"
            className="flex border-b border-hairline"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={[
                    '-mb-px border-b px-5 py-4 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'border-accent-glow text-paper'
                      : 'border-transparent text-paper-4 hover:text-paper-2',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" className="p-5">
            {tab === 'plays' && <PlayByPlay plays={detail.plays} />}
            {tab === 'matchup' && (
              <MatchupTab
                batter={game.batter}
                pitcher={game.pitcher}
                batterSide={detail.batterSide}
                batterDetail={detail.batterDetail}
                pitcherRole={detail.pitcherRole}
                pitcherDetail={detail.pitcherDetail}
                stats={detail.matchup}
              />
            )}
            {tab === 'pitcher' && (
              <PitcherTab
                pitcher={game.pitcher}
                pitcherLine={detail.pitcherLine}
                mix={detail.pitchMix}
              />
            )}
          </div>
        </Card>

        {/* RIGHT: analyst */}
        <AnalystColumn
          compact
          topic={detail.analyst.topic}
          byline={detail.analyst.byline}
          ts={detail.analyst.ts}
        >
          {detail.analyst.paragraphs.map((p, i) => (
            <p
              key={i}
              className={[
                'm-0',
                i > 0 ? 'mt-2.5 text-paper-3' : '',
              ].join(' ')}
            >
              {p}
            </p>
          ))}
        </AnalystColumn>
      </div>
    </div>
  );
}
