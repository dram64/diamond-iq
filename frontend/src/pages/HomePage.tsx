import { LinkButton } from '@/components/primitives/LinkButton';
import { LiveBadge } from '@/components/primitives/LiveBadge';
import { SectionBar } from '@/components/primitives/SectionBar';
import { DemoBadge } from '@/components/primitives/DemoBadge';
import { Skeleton } from '@/components/primitives/Skeleton';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Hero } from '@/components/Hero';
import { CompareStrip } from '@/components/home/CompareStrip';
import { DailyRecapSection } from '@/components/home/DailyRecapSection';
import { DateStrip } from '@/components/home/DateStrip';
import { FeaturedMatchupsSection } from '@/components/home/FeaturedMatchupsSection';
import { FinalsList } from '@/components/home/FinalsList';
import { HardestHitChart } from '@/components/home/HardestHitChart';
import {
  LeaderCard,
  StandingsTableRow,
} from '@/components/home/LeaderCard';
import { LeadersList } from '@/components/home/LeadersList';
import { LiveGameCard } from '@/components/home/LiveGameCard';
import { ScheduleStrip } from '@/components/home/ScheduleStrip';
import { TeamGridCard } from '@/components/home/TeamGridCard';
import { useDailyContent } from '@/hooks/useDailyContent';
import { useScoreboard } from '@/hooks/useScoreboard';
import type { AppGame } from '@/types/app';
import { HARDEST_HIT, STANDINGS_HOME, TEAM_GRID } from '@/mocks';

export function HomePage() {
  const {
    games,
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

  const {
    recap,
    featured,
    isLoading: contentLoading,
    isError: contentError,
    isEmpty: contentEmpty,
  } = useDailyContent();

  // gamePk lookup so the AI sections can pair text with team logos and
  // a "View game" link without re-fetching anything. Built from the
  // already-loaded scoreboard.
  const gamesByPk: ReadonlyMap<number, AppGame> = new Map(games.map((g) => [g.id, g]));

  return (
    <div>
      <div className="mb-6">
        <Hero />
      </div>

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

      {/* [1] Featured Matchups — editorial hero (AI), leads the page */}
      <section className="mb-10 mt-6">
        <FeaturedMatchupsSection
          featured={featured}
          gamesByPk={gamesByPk}
          isLoading={contentLoading}
          isError={contentError}
          isEmpty={contentEmpty}
        />
      </section>

      {/* [2] Yesterday's Game Recaps — stacked AI editorial cards */}
      <section className="mb-10">
        <DailyRecapSection
          recap={recap}
          gamesByPk={gamesByPk}
          isLoading={contentLoading}
          isError={contentError}
          isEmpty={contentEmpty}
        />
      </section>

      {/* [3] Live Scoreboard — DEMOTED supporting role */}
      <section className="mb-8 mt-4">
        <SectionBar
          title="Live Scoreboard"
          small
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
            {liveGames.map((g) => (
              <LiveGameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </section>

      {/* [4] Tonight's Schedule */}
      <section className="mb-10">
        <SectionBar title="Tonight's Schedule" small />
        <ScheduleStrip games={scheduledGames} />
      </section>

      {/* [5] Final Scores */}
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

      {/* [6] Leaders — Batting + Pitching are real (Phase 5F).
            Standings card retains its DemoBadge; Phase 5L+ standings
            ingestion will rewire the third card. */}
      <section className="mb-10">
        <SectionBar
          title="League Leaders"
          right={<LinkButton to="/stats">Full leaderboards →</LinkButton>}
        />
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr] gap-3.5">
          <LeadersList
            title="Batting"
            group="hitting"
            primaryStat="hr"
            secondaryStats={['avg', 'ops', 'woba']}
            cols={['', '', 'HR', 'AVG', 'OPS', 'wOBA']}
            linkTo="/stats"
          />
          <LeadersList
            title="Pitching"
            group="pitching"
            primaryStat="era"
            secondaryStats={['k', 'whip', 'fip']}
            cols={['', '', 'ERA', 'K', 'WHIP', 'FIP']}
            linkTo="/stats"
          />
          <div className="relative">
            <div className="absolute right-3 top-3 z-10">
              <DemoBadge />
            </div>
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
        </div>
      </section>

      {/* [7] Stat of the day — DEMO */}
      <section className="mb-10">
        <SectionBar
          title="Stat of the Day"
          subtitle="Hardest-hit balls · today"
          badge={<DemoBadge />}
          right={<LinkButton to="/stats">Explore more →</LinkButton>}
        />
        <HardestHitChart data={HARDEST_HIT} />
      </section>

      {/* [8] Player comparison — Phase 5H, real data via /api/players/compare */}
      <section className="mb-10">
        <SectionBar
          title="Player Comparison"
          subtitle="Two players, side by side"
          right={<LinkButton to="/compare">Compare players →</LinkButton>}
        />
        <CompareStrip />
      </section>

      {/* [9] Teams — DEMO */}
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[180px]" />
      ))}
    </div>
  );
}

function EmptyLiveGames() {
  return (
    <div className="rounded-l border border-dashed border-hairline-strong bg-surface-2 px-6 py-8 text-center">
      <div className="mx-auto h-2 w-2 rounded-full bg-paper-4 opacity-50" />
      <div className="mt-2 text-[13px] font-semibold text-paper-2">No live games right now</div>
      <div className="mt-1 text-[11px] text-paper-4">
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
