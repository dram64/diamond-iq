/**
 * HomePage — Phase 8.5 PART 3 + Track 1 + Track 2.
 *
 * Layout:
 *
 *   1. FeaturedMatchupHero — full-width editorial centerpiece, fed
 *      by /api/games/featured (real today's MLB game; Track 1).
 *   2. Asymmetric grid below (lg+):
 *        Left  (~60 %)  StandoutPerformancesPanel
 *                       RecentFinalsTile
 *                       TeamSpotlightTile
 *        Right (~40 %)  MiniStandingsTile
 *                       TopBatSpeedTile
 *                       StatcastLeaderOfWeekTile
 *                       NavCard × 4
 *      Mobile (<lg)    everything stacks single-column in source
 *                       order (left column first, then right column).
 *   3. LiveGamesStrip — full-width band, only when live games exist.
 *
 * The standalone <Hero /> photo band was removed in PART 3 v1; the
 * Diamond IQ wordmark lives only in the navbar.
 */

import { FeaturedMatchupHero } from '@/components/home/FeaturedMatchupHero';
import { LiveGamesStrip } from '@/components/home/LiveGamesStrip';
import { MiniStandingsTile } from '@/components/home/MiniStandingsTile';
import { NavCard } from '@/components/home/NavCard';
import { RecentFinalsTile } from '@/components/home/RecentFinalsTile';
import { StandoutPerformancesPanel } from '@/components/home/StandoutPerformancesPanel';
import { StatcastLeaderOfWeekTile } from '@/components/home/StatcastLeaderOfWeekTile';
import { TeamSpotlightTile } from '@/components/home/TeamSpotlightTile';
import { TopBatSpeedTile } from '@/components/home/TopBatSpeedTile';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { useScoreboard } from '@/hooks/useScoreboard';

export function HomePage() {
  const { liveGames, isError, error, isFetching, refetch, lastUpdatedAt } = useScoreboard();

  return (
    <div className="page-editorial flex flex-col gap-10">
      <FeaturedMatchupHero />

      {isError && (
        <ErrorBanner
          title="Couldn't load today's games"
          message={error?.message ?? 'Please try again in a moment.'}
          onRetry={refetch}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-6">
          <StandoutPerformancesPanel />
          <RecentFinalsTile />
          <TeamSpotlightTile />
        </div>
        <div className="flex flex-col gap-3">
          <MiniStandingsTile />
          <TopBatSpeedTile />
          <StatcastLeaderOfWeekTile />
          <div className="grid grid-cols-1 gap-3 pt-1">
            <NavCard
              to="/compare-players"
              kicker="Compare"
              title="Compare players"
              description="Hexagonal radar over six hero stats. Up to four players at once."
            />
            <NavCard
              to="/compare-teams"
              kicker="Compare"
              title="Compare teams"
              description="Two clubs, six aggregate axes, full numerical detail."
            />
            <NavCard
              to="/stats"
              kicker="Stats"
              title="Stat explorer"
              description="Season leaderboards across hitting and pitching."
            />
            <NavCard
              to="/teams"
              kicker="Teams"
              title="All 30 clubs"
              description="Browse by division. Logos, records, deep team pages."
            />
          </div>
        </div>
      </div>

      <LiveGamesStrip
        liveGames={liveGames}
        isFetching={isFetching}
        lastUpdatedAt={lastUpdatedAt}
      />
    </div>
  );
}
