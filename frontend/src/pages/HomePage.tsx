import { LinkButton } from '@/components/primitives/LinkButton';
import { LiveBadge } from '@/components/primitives/LiveBadge';
import { SectionBar } from '@/components/primitives/SectionBar';
import { DemoBadge } from '@/components/primitives/DemoBadge';
import { Skeleton } from '@/components/primitives/Skeleton';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { CompareStrip } from '@/components/home/CompareStrip';
import { DateStrip } from '@/components/home/DateStrip';
import { FinalsList } from '@/components/home/FinalsList';
import { HardestHitChart } from '@/components/home/HardestHitChart';
import { InsightCard } from '@/components/home/InsightCard';
import {
  LeaderCard,
  LeaderRow,
  StandingsTableRow,
} from '@/components/home/LeaderCard';
import { LiveGameCard } from '@/components/home/LiveGameCard';
import { ScheduleStrip } from '@/components/home/ScheduleStrip';
import { TeamGridCard } from '@/components/home/TeamGridCard';
import { useScoreboard } from '@/hooks/useScoreboard';
import { formatBA } from '@/lib/format';
import {
  AI_INSIGHTS,
  BATTING_LEADERS,
  COMPARE_MAX,
  COMPARE_PREVIEW,
  HARDEST_HIT,
  PITCHING_LEADERS,
  STANDINGS_HOME,
  TEAM_GRID,
} from '@/mocks';

export function HomePage() {
  const {
    liveGames,
    finalGames,
    scheduledGames,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    lastUpdatedAt,
  } = useScoreboard();

  return (
    <div>
      <DateStrip
        live={liveGames.length}
        finals={finalGames.length}
        upcoming={scheduledGames.length}
      />

      {isError && (
        <div className="mt-4">
          <ErrorBanner
            title="Couldn't load today's games"
            message={error?.message ?? 'Please try again in a moment.'}
            onRetry={refetch}
          />
        </div>
      )}

      {/* [1] Live games — hero */}
      <section className="mb-10 mt-6">
        <SectionBar
          title="Live Now"
          badge={<LiveBadge count={liveGames.length} />}
          right={
            <span className="text-xs text-paper-4">
              {isFetching ? 'Refreshing…' : 'Updated '}
              <span className="mono text-paper-3">
                {!isFetching && formatRelative(lastUpdatedAt)}
              </span>
            </span>
          }
        />
        {isLoading ? (
          <LiveGamesLoading />
        ) : liveGames.length === 0 ? (
          <EmptyLiveGames />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
            {liveGames.map((g) => (
              <LiveGameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </section>

      {/* [2] AI Insights — DEMO */}
      <section className="mb-10">
        <SectionBar
          title="AI Insights"
          small
          badge={<DemoBadge />}
          right={<LinkButton to="/live/g1">Open analyst →</LinkButton>}
        />
        <div className="grid grid-cols-3 gap-3">
          {AI_INSIGHTS.map((ins) => (
            <InsightCard key={ins.topic} insight={ins} />
          ))}
        </div>
      </section>

      {/* [3] Scheduled */}
      <section className="mb-10">
        <SectionBar title="Tonight's Schedule" small />
        <ScheduleStrip games={scheduledGames} />
      </section>

      {/* [4] Finals */}
      <section className="mb-10">
        <SectionBar
          title="Final Scores"
          small
          right={
            <span className="text-xs text-paper-4">
              {finalGames.length} {finalGames.length === 1 ? 'game' : 'games'}
            </span>
          }
        />
        <FinalsList games={finalGames} />
      </section>

      {/* [5] Leaders — DEMO */}
      <section className="mb-10">
        <SectionBar
          title="League Leaders"
          badge={<DemoBadge />}
          right={<LinkButton to="/stats">Full leaderboards →</LinkButton>}
        />
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr] gap-3.5">
          <LeaderCard
            title="Batting"
            cols={['', 'AVG', 'HR', 'RBI', 'WAR']}
            linkTo="/stats"
          >
            {BATTING_LEADERS.map((p, i) => (
              <LeaderRow
                key={p.name}
                rank={i + 1}
                name={p.name}
                team={p.team}
                values={[formatBA(p.avg), p.hr, p.rbi, p.war.toFixed(1)]}
                highlight={[false, false, false, true]}
              />
            ))}
          </LeaderCard>
          <LeaderCard
            title="Pitching"
            cols={['', 'ERA', 'W-L', 'K', 'WHIP']}
            linkTo="/stats"
          >
            {PITCHING_LEADERS.map((p, i) => (
              <LeaderRow
                key={p.name}
                rank={i + 1}
                name={p.name}
                team={p.team}
                values={[p.era.toFixed(2), p.wl, p.k, p.whip.toFixed(2)]}
                highlight={[true, false, false, false]}
              />
            ))}
          </LeaderCard>
          <LeaderCard
            title="Standings · PL West"
            cols={['', 'W-L', 'GB', 'Run diff']}
            linkTo="/teams"
          >
            {STANDINGS_HOME.map((row, i) => (
              <StandingsTableRow key={row.team} rank={i + 1} row={row} />
            ))}
          </LeaderCard>
        </div>
      </section>

      {/* [6] Stat of the day — DEMO */}
      <section className="mb-10">
        <SectionBar
          title="Stat of the Day"
          subtitle="Hardest-hit balls · today"
          badge={<DemoBadge />}
          right={<LinkButton to="/stats">Explore more →</LinkButton>}
        />
        <HardestHitChart data={HARDEST_HIT} />
      </section>

      {/* [7] Player comparison — DEMO */}
      <section className="mb-10">
        <SectionBar
          title="Player Comparison"
          subtitle="Two MVP cases, side by side"
          badge={<DemoBadge />}
          right={<LinkButton to="/compare">Compare players →</LinkButton>}
        />
        <CompareStrip data={COMPARE_PREVIEW} max={COMPARE_MAX} />
      </section>

      {/* [8] Teams — DEMO */}
      <section className="mb-5">
        <SectionBar
          title="Team Dashboards"
          badge={<DemoBadge />}
          right={<LinkButton to="/teams">See all teams →</LinkButton>}
        />
        <div className="grid grid-cols-4 gap-3">
          {TEAM_GRID.map((t) => (
            <TeamGridCard key={t.id} entry={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LiveGamesLoading() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[230px]" />
      ))}
    </div>
  );
}

function EmptyLiveGames() {
  return (
    <div className="rounded-l border border-dashed border-hairline-strong bg-surface-2 px-6 py-12 text-center">
      <div className="mx-auto h-2 w-2 rounded-full bg-paper-4 opacity-50" />
      <div className="mt-3 text-[14px] font-semibold text-paper-2">No live games right now</div>
      <div className="mt-1 text-[12px] text-paper-4">
        Check back when first pitch is in.
      </div>
    </div>
  );
}

function formatRelative(ts: number | null): string {
  if (!ts) return '';
  const ageSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (ageSec < 5) return 'just now';
  if (ageSec < 60) return `${ageSec}s ago`;
  const mins = Math.floor(ageSec / 60);
  return `${mins}m ago`;
}
