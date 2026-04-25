import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AnalystColumn } from '@/components/primitives/AnalystColumn';
import { Card } from '@/components/primitives/Card';
import { DemoBadge } from '@/components/primitives/DemoBadge';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { SectionHeaderSmall } from '@/components/primitives/SectionHeaderSmall';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PitchList } from '@/components/charts/PitchList';
import { StrikeZone } from '@/components/charts/StrikeZone';
import { LiveGameHeader } from '@/components/live-game/LiveGameHeader';
import { MatchupTab } from '@/components/live-game/MatchupTab';
import { PitcherTab } from '@/components/live-game/PitcherTab';
import { PlayByPlay } from '@/components/live-game/PlayByPlay';
import { WinProbStrip } from '@/components/live-game/WinProbStrip';
import { useGame } from '@/hooks/useGame';
import { liveGameDetail } from '@/mocks/liveGame';
import { todayUtcDate } from '@/lib/dateUtils';

type TabId = 'plays' | 'matchup' | 'pitcher';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'plays', label: 'Play-by-play' },
  { id: 'matchup', label: 'Matchup' },
  { id: 'pitcher', label: 'Pitcher' },
];

const EMDASH = '—';

export function LiveGamePage() {
  const { gameId: rawGameId } = useParams<{ gameId: string }>();
  const [search] = useSearchParams();
  const date = search.get('date') ?? todayUtcDate();

  const parsed = rawGameId ? Number.parseInt(rawGameId, 10) : NaN;
  const gameId = Number.isFinite(parsed) ? parsed : undefined;
  const [tab, setTab] = useState<TabId>('plays');

  // Hooks must run unconditionally — pass undefined to keep useGame disabled
  // when the URL param is missing/malformed, and Navigate after.
  const { game, isLoading, isError, error, refetch } = useGame(gameId, date);

  // Mock-driven detail content keyed by the game id (mock falls back to a
  // single canonical detail set; that's intentional for now).
  const detail = liveGameDetail(String(gameId ?? ''));

  if (gameId === undefined) {
    return <Navigate to="/" replace />;
  }
  if (isError && error?.status === 404) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      {isLoading ? (
        <Skeleton className="h-[170px]" />
      ) : isError ? (
        <ErrorBanner
          title="Couldn't load this game"
          message={error?.message ?? 'Please try again in a moment.'}
          onRetry={refetch}
        />
      ) : game ? (
        <LiveGameHeader game={game} />
      ) : null}

      <div className="mx-0.5 mb-8 mt-3.5">
        {game && (
          <WinProbStrip
            away={game.away}
            home={game.home}
            wp={game.winProbability ?? 50}
          />
        )}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_1fr] items-start gap-5">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <SectionHeaderSmall
              kicker="Current at-bat"
              title={game?.batter ?? EMDASH}
            />
            <DemoBadge />
          </div>
          <div className="mt-1.5 flex flex-col items-center">
            <StrikeZone pitches={detail.pitches} batter={detail.batterSide} />
          </div>
          <div className="mt-3.5 border-t border-hairline pt-3.5">
            <PitchList pitches={detail.pitches} />
          </div>
        </Card>

        <Card flush>
          <div
            role="tablist"
            aria-label="Live game detail"
            className="flex items-center justify-between border-b border-hairline pr-4"
          >
            <div className="flex">
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
            <DemoBadge />
          </div>
          <div id={`panel-${tab}`} role="tabpanel" className="p-5">
            {tab === 'plays' && <PlayByPlay plays={detail.plays} />}
            {tab === 'matchup' && (
              <MatchupTab
                batter={game?.batter ?? EMDASH}
                pitcher={game?.pitcher ?? EMDASH}
                batterSide={detail.batterSide}
                batterDetail={detail.batterDetail}
                pitcherRole={detail.pitcherRole}
                pitcherDetail={detail.pitcherDetail}
                stats={detail.matchup}
              />
            )}
            {tab === 'pitcher' && (
              <PitcherTab
                pitcher={game?.pitcher ?? EMDASH}
                pitcherLine={detail.pitcherLine}
                mix={detail.pitchMix}
              />
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <DemoBadge />
          </div>
          <AnalystColumn
            compact
            topic={detail.analyst.topic}
            byline={detail.analyst.byline}
            ts={detail.analyst.ts}
          >
            {detail.analyst.paragraphs.map((p, i) => (
              <p
                key={i}
                className={['m-0', i > 0 ? 'mt-2.5 text-paper-3' : ''].join(' ')}
              >
                {p}
              </p>
            ))}
          </AnalystColumn>
        </div>
      </div>
    </div>
  );
}
