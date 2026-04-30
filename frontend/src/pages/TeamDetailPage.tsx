/**
 * TeamDetailPage — Phase 6.
 *
 * Three blocks:
 *   1. Header: logo, full name, division, current standings (W-L, GB).
 *   2. Team-aggregate stats: hitting + pitching from /api/teams/{id}/stats.
 *   3. Roster grid with PlayerHeadshots, click-through to /compare-players?ids=<id>.
 */

import { useParams, Link, Navigate } from 'react-router-dom';

import { Card } from '@/components/primitives/Card';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PlayerHeadshot } from '@/components/PlayerHeadshot';
import { useRoster } from '@/hooks/useRoster';
import { useStandings } from '@/hooks/useStandings';
import { useTeamStats } from '@/hooks/useTeamStats';
import { getMlbTeam } from '@/lib/mlbTeams';

const HITTING_STATS: Array<{ token: string; label: string }> = [
  { token: 'avg', label: 'AVG' },
  { token: 'home_runs', label: 'HR' },
  { token: 'rbi', label: 'RBI' },
  { token: 'obp', label: 'OBP' },
  { token: 'slg', label: 'SLG' },
  { token: 'ops', label: 'OPS' },
  { token: 'stolen_bases', label: 'SB' },
  { token: 'runs', label: 'R' },
];

const PITCHING_STATS: Array<{ token: string; label: string }> = [
  { token: 'era', label: 'ERA' },
  { token: 'whip', label: 'WHIP' },
  { token: 'strikeouts', label: 'K' },
  { token: 'wins', label: 'W' },
  { token: 'losses', label: 'L' },
  { token: 'saves', label: 'SV' },
  { token: 'opp_avg', label: 'OPP AVG' },
  { token: 'innings_pitched', label: 'IP' },
];

export function TeamDetailPage() {
  const { teamId: raw } = useParams<{ teamId: string }>();
  const teamId = raw ? Number.parseInt(raw, 10) : NaN;
  const valid = Number.isFinite(teamId);

  // Hooks must run unconditionally; pass null when invalid so the disabled
  // queries skip their network call.
  const stats = useTeamStats(valid ? teamId : null);
  const roster = useRoster(valid ? teamId : null);
  const standings = useStandings();

  if (!valid) return <Navigate to="/teams" replace />;

  const meta = getMlbTeam(teamId);
  const standingsRow = standings.data?.data.teams.find((t) => t.team_id === teamId);

  return (
    <section>
      <div className="kicker mb-2">Team</div>
      <h1 className="text-2xl font-bold tracking-tight text-paper-2">
        {meta?.fullName ?? `Team ${teamId}`}
      </h1>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-5">
          {meta && (
            <img
              src={meta.logoPath}
              alt={meta.fullName}
              width={72}
              height={72}
              className="h-18 w-18 shrink-0 object-contain"
            />
          )}
          <div className="flex flex-1 flex-col gap-1">
            <div className="kicker text-paper-4">
              {meta ? `${meta.league} ${meta.division}` : 'MLB'}
            </div>
            <div className="text-xl font-bold -tracking-[0.01em] text-paper">
              {meta?.fullName ?? `Team ${teamId}`}
            </div>
            {standingsRow ? (
              <div className="mono text-[12px] text-paper-3">
                {standingsRow.wins}-{standingsRow.losses}
                {standingsRow.games_back && standingsRow.games_back !== '-' && (
                  <span className="text-paper-4"> · {standingsRow.games_back} GB</span>
                )}
                {standingsRow.pct && (
                  <span className="text-paper-4"> · {standingsRow.pct} win%</span>
                )}
              </div>
            ) : (
              <Skeleton className="h-3 w-32" />
            )}
          </div>
          <Link
            to={`/compare-teams?ids=${teamId},147`}
            className="rounded-s border border-hairline px-3 py-1.5 text-[12px] font-semibold text-paper-3 hover:border-accent hover:text-accent"
          >
            Compare with another team →
          </Link>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="kicker mb-3 text-paper-4">Team batting</div>
          {stats.isLoading ? (
            <StatsSkeleton />
          ) : stats.isError ? (
            <ErrorBanner
              title="Stats unavailable"
              message={stats.error?.message ?? 'Try again shortly.'}
              onRetry={() => void stats.refetch()}
            />
          ) : (
            <StatGrid stats={stats.data?.data.hitting} rows={HITTING_STATS} />
          )}
        </Card>
        <Card>
          <div className="kicker mb-3 text-paper-4">Team pitching</div>
          {stats.isLoading ? (
            <StatsSkeleton />
          ) : stats.isError ? null : (
            <StatGrid stats={stats.data?.data.pitching} rows={PITCHING_STATS} />
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="kicker mb-3 text-paper-4">Active roster</div>
        {roster.isLoading ? (
          <RosterSkeleton />
        ) : roster.isError ? (
          <ErrorBanner
            title="Couldn't load roster"
            message={roster.error?.message ?? 'Try again shortly.'}
            onRetry={() => void roster.refetch()}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {(roster.data?.data.roster ?? []).map((p) => (
              <Link
                key={p.person_id}
                to={`/compare-players?ids=${p.person_id}`}
                className="group flex items-center gap-3 rounded-m border border-hairline bg-surface-1 px-3 py-2 hover:border-accent"
              >
                <PlayerHeadshot
                  playerId={p.person_id}
                  playerName={p.full_name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-paper-2 group-hover:text-accent">
                    {p.full_name}
                  </div>
                  <div className="mono text-[10.5px] text-paper-4">
                    {p.position_abbr}
                    {p.jersey_number ? ` · #${p.jersey_number}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function StatGrid({
  stats,
  rows,
}: {
  stats: Record<string, unknown> | null | undefined;
  rows: Array<{ token: string; label: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map((r) => {
        const v = stats?.[r.token];
        const display =
          v === null || v === undefined || v === ''
            ? '—'
            : typeof v === 'number'
              ? Number.isInteger(v)
                ? v.toString()
                : v.toFixed(2)
              : String(v);
        return (
          <div key={r.token} className="flex flex-col">
            <span className="kicker text-[10px] text-paper-4">{r.label}</span>
            <span className="mono text-[15px] font-bold text-paper-2">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-1 h-3 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-m border border-hairline bg-surface-1 px-3 py-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="mb-1 h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
