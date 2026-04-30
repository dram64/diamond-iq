/**
 * StatsPage — Phase 6 leaderboards browser.
 *
 * Stat picker (group + token) drives a single /api/leaders call. Results
 * render as a ranked table with player headshot, team logo, and the
 * primary value plus a couple of context columns.
 *
 * The available stat catalog is hardcoded to the set the backend already
 * supports (see _LEADER_STATS in functions/api_players/routes/leaders.py).
 * URL ?group=hitting&stat=woba shares state.
 */

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Card } from '@/components/primitives/Card';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PlayerHeadshot } from '@/components/PlayerHeadshot';
import { useLeaders } from '@/hooks/useLeaders';
import { getMlbTeam } from '@/lib/mlbTeams';
import { formatStat, statStorageField } from '@/lib/stats';
import type { LeaderGroup } from '@/types/leaders';

interface StatOption {
  group: LeaderGroup;
  token: string;
  label: string;
  description: string;
}

const STAT_CATALOG: readonly StatOption[] = [
  // Hitting
  { group: 'hitting', token: 'woba', label: 'wOBA', description: 'Weighted on-base avg' },
  { group: 'hitting', token: 'ops_plus', label: 'OPS+', description: 'Park-adjusted OPS index' },
  { group: 'hitting', token: 'hr', label: 'HR', description: 'Home runs' },
  { group: 'hitting', token: 'rbi', label: 'RBI', description: 'Runs batted in' },
  { group: 'hitting', token: 'avg', label: 'AVG', description: 'Batting average' },
  { group: 'hitting', token: 'ops', label: 'OPS', description: 'On-base + slugging' },
  // Pitching
  { group: 'pitching', token: 'era', label: 'ERA', description: 'Earned-run average (lower better)' },
  { group: 'pitching', token: 'fip', label: 'FIP', description: 'Fielding-independent pitching' },
  { group: 'pitching', token: 'whip', label: 'WHIP', description: 'Walks + hits per IP (lower better)' },
  { group: 'pitching', token: 'k', label: 'K', description: 'Strikeouts' },
  { group: 'pitching', token: 'wins', label: 'W', description: 'Wins' },
  { group: 'pitching', token: 'saves', label: 'SV', description: 'Saves' },
];

const DEFAULT_GROUP: LeaderGroup = 'hitting';
const DEFAULT_STAT = 'woba';
const TOP_N = 50;

export function StatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupParam = searchParams.get('group');
  const statParam = searchParams.get('stat');

  const active = useMemo<StatOption>(() => {
    const found = STAT_CATALOG.find(
      (s) => s.group === groupParam && s.token === statParam,
    );
    return (
      found ??
      STAT_CATALOG.find((s) => s.group === DEFAULT_GROUP && s.token === DEFAULT_STAT)!
    );
  }, [groupParam, statParam]);

  const leaders = useLeaders(active.group, active.token, TOP_N);

  function pick(s: StatOption) {
    setSearchParams({ group: s.group, stat: s.token });
  }

  return (
    <section>
      <div className="kicker mb-2">Stats</div>
      <h1 className="text-2xl font-bold tracking-tight text-paper-2">Stat Explorer</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-paper-4">
        Top {TOP_N} qualified leaders for the selected stat, refreshed daily.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <StatPickerRow
          group="hitting"
          options={STAT_CATALOG.filter((s) => s.group === 'hitting')}
          activeToken={active.group === 'hitting' ? active.token : ''}
          onPick={pick}
        />
        <StatPickerRow
          group="pitching"
          options={STAT_CATALOG.filter((s) => s.group === 'pitching')}
          activeToken={active.group === 'pitching' ? active.token : ''}
          onPick={pick}
        />
      </div>

      <div className="mt-5">
        <Card>
          <div className="mb-4 flex items-baseline justify-between border-b border-hairline-strong pb-3">
            <div>
              <div className="kicker text-paper-4">{active.group}</div>
              <h2 className="text-xl font-bold text-paper-2">{active.label}</h2>
              <div className="text-[12px] text-paper-4">{active.description}</div>
            </div>
            <div className="mono text-[11px] text-paper-4">Top {TOP_N}</div>
          </div>
          {leaders.isLoading ? (
            <LeaderSkeleton />
          ) : leaders.isError ? (
            <ErrorBanner
              title="Couldn't load leaderboard"
              message={leaders.error?.message ?? 'Try again shortly.'}
              onRetry={() => void leaders.refetch()}
            />
          ) : (
            <LeaderTable
              rows={leaders.data?.data.leaders ?? []}
              statToken={active.token}
              statLabel={active.label}
            />
          )}
        </Card>
      </div>
    </section>
  );
}

interface StatPickerRowProps {
  group: 'hitting' | 'pitching';
  options: readonly StatOption[];
  activeToken: string;
  onPick: (s: StatOption) => void;
}

function StatPickerRow({ group, options, activeToken, onPick }: StatPickerRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="kicker w-[72px] text-paper-4">{group}</span>
      {options.map((s) => {
        const active = s.token === activeToken;
        return (
          <button
            key={s.token}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(s)}
            className={[
              'rounded-s px-3 py-1.5 text-[12px] font-semibold transition-colors',
              active ? 'bg-accent text-white' : 'bg-surface-2 text-paper-3 hover:bg-surface-3',
            ].join(' ')}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

interface LeaderTableProps {
  rows: ReadonlyArray<{
    person_id: number;
    full_name: string;
    team_id?: number;
    rank: number;
    [key: string]: unknown;
  }>;
  statToken: string;
  statLabel: string;
}

function LeaderTable({ rows, statToken, statLabel }: LeaderTableProps) {
  if (rows.length === 0) {
    return (
      <div className="px-2 py-10 text-center text-[13px] text-paper-4">
        No qualified leaders for this stat yet.
      </div>
    );
  }
  const storageField = statStorageField(statToken);

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[40px_1fr_120px_100px] items-center gap-3 border-b border-hairline px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-paper-4">
        <span>Rank</span>
        <span>Player</span>
        <span>Team</span>
        <span className="text-right">{statLabel}</span>
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const team = r.team_id != null ? getMlbTeam(r.team_id) : undefined;
          const value = r[storageField] ?? r[statToken];
          return (
            <li key={r.person_id}>
              <Link
                to={`/compare-players?ids=${r.person_id}`}
                className="grid grid-cols-[40px_1fr_120px_100px] items-center gap-3 border-b border-hairline px-2 py-2 text-[13px] hover:bg-surface-2"
              >
                <span className="mono text-paper-4">#{r.rank}</span>
                <div className="flex items-center gap-2.5">
                  <PlayerHeadshot playerId={r.person_id} playerName={r.full_name} size="sm" />
                  <span className="font-semibold text-paper-2">{r.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {team ? (
                    <>
                      <img src={team.logoPath} alt="" width={16} height={16} className="h-4 w-4" />
                      <span className="mono text-[11px] text-paper-4">{team.abbreviation}</span>
                    </>
                  ) : (
                    <span className="mono text-[11px] text-paper-5">—</span>
                  )}
                </div>
                <span className="mono text-right text-[14px] font-bold text-paper-2">
                  {formatStat(statToken, (value as number | string | null | undefined) ?? null)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[40px_1fr_120px_100px] items-center gap-3 px-2 py-2"
        >
          <Skeleton className="h-3 w-6" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
