/**
 * FeaturedMatchupSection — Phase 6 home-page editorial card.
 *
 * Renders the daily-rotating two-player pick from /api/featured-matchup.
 * Two large headshots side-by-side, name + team + position chips, today's
 * wOBA, click-through to /compare-players?ids=<a>,<b> for the deep dive.
 *
 * Selection logic lives backend-side (see ADR 015 Phase 6 amendment): a
 * deterministic seeded RNG over the top-10 wOBA leaderboard, preferring
 * cross-team pairs. Stable for the UTC day, rotates the next.
 */

import { Link } from 'react-router-dom';

import { Card } from '@/components/primitives/Card';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PlayerHeadshot } from '@/components/PlayerHeadshot';
import { useFeaturedMatchup } from '@/hooks/useFeaturedMatchup';
import { getMlbTeam } from '@/lib/mlbTeams';
import type { FeaturedMatchupPlayer } from '@/types/featuredMatchup';

export function FeaturedMatchupSection() {
  const { data, isLoading, isError, error, refetch } = useFeaturedMatchup();

  if (isLoading) return <SkeletonCard />;
  if (isError) {
    return (
      <ErrorBanner
        title="Couldn't load today's featured matchup"
        message={error?.message ?? 'Please try again shortly.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const matchup = data?.data;
  if (!matchup || matchup.players.length < 2) {
    return (
      <Card>
        <div className="px-2 py-6 text-center text-[12px] text-paper-4">
          Today's featured matchup is unavailable.
        </div>
      </Card>
    );
  }

  const [a, b] = matchup.players;
  const target = `/compare-players?ids=${matchup.player_ids.join(',')}`;
  return (
    <Card className="overflow-hidden">
      <Link
        to={target}
        className="group flex flex-col gap-5 transition hover:opacity-95"
        aria-label={`Compare ${a.full_name ?? 'player A'} vs ${b.full_name ?? 'player B'}`}
      >
        <div className="flex items-center justify-between border-b border-hairline-strong pb-3">
          <div className="kicker text-accent">Today's Featured Matchup</div>
          <div className="mono text-[10.5px] text-paper-4">
            {matchup.date} · {matchup.selection_reason}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <PlayerSide player={a} alignRight={false} />
          <div className="hidden text-center sm:block">
            <span className="mono text-[26px] font-bold text-paper-4">vs</span>
          </div>
          <PlayerSide player={b} alignRight />
        </div>

        <div className="flex items-center justify-between border-t border-hairline pt-3 text-[12px] text-paper-3">
          <span>Side-by-side stats, accolades, and analysis →</span>
          <span className="text-accent group-hover:underline">Open compare →</span>
        </div>
      </Link>
    </Card>
  );
}

function PlayerSide({
  player,
  alignRight,
}: {
  player: FeaturedMatchupPlayer;
  alignRight: boolean;
}) {
  const team = player.team_id != null ? getMlbTeam(player.team_id) : undefined;
  const sublabel = [team?.locationName, player.primary_position_abbr].filter(Boolean).join(' · ');
  return (
    <div
      className={[
        'flex items-center gap-4',
        alignRight ? 'sm:flex-row-reverse sm:text-right' : '',
      ].join(' ')}
    >
      <PlayerHeadshot
        playerId={player.person_id}
        playerName={player.full_name ?? undefined}
        size="lg"
      />
      <div className="flex flex-col gap-0.5">
        <div className="kicker text-paper-4">{sublabel || '—'}</div>
        <div className="text-2xl font-bold -tracking-[0.01em] text-paper">
          {player.full_name ?? '—'}
        </div>
        <div className="mono text-[12px] text-paper-3">
          wOBA{' '}
          <span className="font-semibold text-paper">
            {player.woba != null ? String(player.woba) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <Skeleton className="mb-4 h-3 w-48" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
