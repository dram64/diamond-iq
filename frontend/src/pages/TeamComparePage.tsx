/**
 * TeamComparePage — full-page side-by-side comparison for two MLB teams.
 *
 * Picker mechanics:
 *   - Two `<select>` dropdowns of all 30 teams (sourced from getAllMlbTeams).
 *   - URL `?ids=<a>,<b>` keeps the selection shareable / bookmarkable.
 *
 * Display blocks:
 *   - Team batting stats (avg, hr, rbi, obp, slg, ops, stolen_bases).
 *   - Team pitching stats (era, whip, strikeouts, wins, saves, opp_avg).
 *   - Visual delta indicators reuse the per-row max-with-5%-headroom pattern
 *     from CompareStrip; ascending stats (ERA/WHIP/opp_avg) flip the bar so
 *     visually-longer = better stays the user's mental model.
 *
 * Logo + brand-color chips in the header are sourced from the static
 * mlbTeams table — no extra round-trip.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Card } from '@/components/primitives/Card';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { useTeamCompare } from '@/hooks/useTeamCompare';
import { getAllMlbTeams, getMlbTeam } from '@/lib/mlbTeams';
import {
  compareStatBetter,
  formatStat,
  isAscendingStat,
  parseStatNumber,
} from '@/lib/stats';
import type { TeamStats } from '@/types/teamStats';

const HITTING_ROWS: readonly { token: string; label: string }[] = [
  { token: 'avg', label: 'AVG' },
  { token: 'home_runs', label: 'HR' },
  { token: 'rbi', label: 'RBI' },
  { token: 'obp', label: 'OBP' },
  { token: 'slg', label: 'SLG' },
  { token: 'ops', label: 'OPS' },
  { token: 'stolen_bases', label: 'SB' },
];

const PITCHING_ROWS: readonly { token: string; label: string }[] = [
  { token: 'era', label: 'ERA' },
  { token: 'whip', label: 'WHIP' },
  { token: 'strikeouts', label: 'K' },
  { token: 'wins', label: 'W' },
  { token: 'saves', label: 'SV' },
  { token: 'opp_avg', label: 'OPP AVG' },
];

// Team-stat ascending tokens that don't appear in the player-side stats
// module's ASCENDING_STATS set. Treated locally so the bar inversion still
// fires on the team page without modifying lib/stats.ts.
const TEAM_ASCENDING_LOCAL = new Set(['opp_avg']);

const DEFAULT_PAIR: readonly [number, number] = [147, 121]; // Yankees vs Mets

function parseIdsParam(raw: string | null): readonly number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function TeamComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsFromUrl = useMemo(() => parseIdsParam(searchParams.get('ids')), [searchParams]);
  const ids = idsFromUrl.length === 2 ? idsFromUrl : DEFAULT_PAIR;
  const [idA, idB] = ids;

  const compare = useTeamCompare(ids);

  function setSlot(slot: 'a' | 'b', nextId: number) {
    const next = slot === 'a' ? [nextId, idB] : [idA, nextId];
    setSearchParams({ ids: next.join(',') });
  }

  const allTeams = getAllMlbTeams();

  return (
    <section>
      <div className="kicker mb-2">Compare</div>
      <h1 className="text-2xl font-bold tracking-tight text-paper-2">Team Compare</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-paper-4">
        Two MLB clubs, side by side. Season-aggregate batting and pitching with
        a visual delta on every row.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TeamSelect
          label="Team A"
          value={idA}
          otherValue={idB}
          options={allTeams}
          onChange={(id) => setSlot('a', id)}
        />
        <TeamSelect
          label="Team B"
          value={idB}
          otherValue={idA}
          options={allTeams}
          onChange={(id) => setSlot('b', id)}
        />
      </div>

      <div className="mt-5">
        {compare.isLoading ? (
          <ComparePanelSkeleton />
        ) : compare.isError ? (
          <ErrorBanner
            title="Couldn't load comparison"
            message={compare.error?.message ?? 'Please try again in a moment.'}
            onRetry={() => void compare.refetch()}
          />
        ) : (
          <ComparePanel teams={compare.data?.data.teams ?? []} />
        )}
      </div>
    </section>
  );
}

interface TeamSelectProps {
  label: string;
  value: number;
  otherValue: number;
  options: readonly { id: number; abbreviation: string; fullName: string }[];
  onChange: (id: number) => void;
}

function TeamSelect({ label, value, otherValue, options, onChange }: TeamSelectProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="kicker text-[10px] text-paper-4">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        className="rounded-m border border-hairline-strong bg-surface-1 px-3 py-2 text-[13px] font-medium text-paper-2 outline-none focus:border-accent"
      >
        {options.map((t) => (
          <option key={t.id} value={t.id} disabled={t.id === otherValue}>
            {t.abbreviation} — {t.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ComparePanelProps {
  teams: readonly TeamStats[];
}

function ComparePanel({ teams }: ComparePanelProps) {
  if (teams.length < 2) {
    return (
      <Card>
        <div className="px-2 py-10 text-center text-[13px] text-paper-4">
          Comparison data unavailable.
        </div>
      </Card>
    );
  }

  // The backend may return teams in id-sort order rather than the URL order.
  // Re-align so visual A/B matches the user's selection.
  const [a, b] = teams;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Header a={a} b={b} />
      </Card>
      <Card>
        <BlockHeading>Team Batting</BlockHeading>
        <StatBlock a={a.hitting} b={b.hitting} rows={HITTING_ROWS} />
      </Card>
      <Card>
        <BlockHeading>Team Pitching</BlockHeading>
        <StatBlock a={a.pitching} b={b.pitching} rows={PITCHING_ROWS} />
      </Card>
    </div>
  );
}

function BlockHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-paper-4">
      {children}
    </div>
  );
}

interface HeaderProps {
  a: TeamStats;
  b: TeamStats;
}

function Header({ a, b }: HeaderProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <TeamSide team={a} accent />
      <TeamSide team={b} />
    </div>
  );
}

function TeamSide({ team, accent = false }: { team: TeamStats; accent?: boolean }) {
  const meta = getMlbTeam(team.team_id);
  const games = (team.hitting?.games_played as number | undefined) ?? null;
  return (
    <div className="flex items-center gap-4">
      {meta ? (
        <img
          src={meta.logoPath}
          alt={meta.fullName}
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 shrink-0 object-contain"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-full bg-surface-3" />
      )}
      <div className="flex flex-col gap-0.5">
        <div className={['kicker', accent ? 'text-accent' : 'text-paper-4'].join(' ')}>
          {meta ? `${meta.league} ${meta.division}` : 'MLB'}
        </div>
        <div className="text-2xl font-bold -tracking-[0.01em] text-paper">
          {team.team_name}
        </div>
        <div className="mono text-[11px] text-paper-4">
          {games ? `${games} games · ` : ''}Season {team.season}
        </div>
      </div>
    </div>
  );
}

interface StatBlockProps {
  a: Record<string, unknown>;
  b: Record<string, unknown>;
  rows: readonly { token: string; label: string }[];
}

function StatBlock({ a, b, rows }: StatBlockProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((row) => (
        <StatRow
          key={row.token}
          stat={row.token}
          label={row.label}
          valueA={a?.[row.token] as number | string | undefined}
          valueB={b?.[row.token] as number | string | undefined}
        />
      ))}
    </div>
  );
}

interface StatRowProps {
  stat: string;
  label: string;
  valueA: number | string | null | undefined;
  valueB: number | string | null | undefined;
}

function StatRow({ stat, label, valueA, valueB }: StatRowProps) {
  // Direction: stats from lib/stats.ts (era/whip/fip) plus team-only locals.
  const ascending = isAscendingStat(stat) || TEAM_ASCENDING_LOCAL.has(stat);
  // For the winner test, when our local-only ascending stat fires we need to
  // override compareStatBetter (which doesn't know about opp_avg). Compute it
  // ourselves in that case.
  const winner = TEAM_ASCENDING_LOCAL.has(stat)
    ? localCompareAscending(valueA, valueB)
    : compareStatBetter(stat, valueA, valueB);

  const na = parseStatNumber(valueA);
  const nb = parseStatNumber(valueB);
  const both = na !== null && nb !== null;
  const max = both ? Math.max(na!, nb!) * 1.05 || 1 : 1;
  const fillA = both ? (ascending ? Math.max(0, max - na!) / max : na! / max) : 0;
  const fillB = both ? (ascending ? Math.max(0, max - nb!) / max : nb! / max) : 0;

  const aWins = winner === 'a';
  const bWins = winner === 'b';

  return (
    <div className="grid grid-cols-[1fr_72px_1fr] items-center gap-4">
      <div className="flex items-center justify-end gap-3">
        <span
          className={[
            'mono text-[15px]',
            aWins ? 'font-bold text-accent' : 'font-medium text-paper-3',
          ].join(' ')}
        >
          {formatStat(stat, valueA ?? null)}
        </span>
        <div className="relative h-2 w-full max-w-[260px] overflow-hidden rounded-s bg-surface-3">
          <div
            className={[
              'absolute inset-y-0 right-0 transition-[width] duration-300',
              aWins ? 'bg-accent' : 'bg-paper-5',
            ].join(' ')}
            style={{ width: `${fillA * 100}%` }}
          />
        </div>
      </div>
      <span className="kicker text-center text-[10.5px]">{label}</span>
      <div className="flex items-center gap-3">
        <div className="relative h-2 w-full max-w-[260px] overflow-hidden rounded-s bg-surface-3">
          <div
            className={[
              'h-full transition-[width] duration-300',
              bWins ? 'bg-accent' : 'bg-paper-5',
            ].join(' ')}
            style={{ width: `${fillB * 100}%` }}
          />
        </div>
        <span
          className={[
            'mono text-[15px]',
            bWins ? 'font-bold text-accent' : 'font-medium text-paper-3',
          ].join(' ')}
        >
          {formatStat(stat, valueB ?? null)}
        </span>
      </div>
    </div>
  );
}

function localCompareAscending(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): 'a' | 'b' | 'tie' | null {
  const na = parseStatNumber(a);
  const nb = parseStatNumber(b);
  if (na === null || nb === null) return null;
  if (na === nb) return 'tie';
  return na < nb ? 'a' : 'b';
}

function ComparePanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton className="mb-4 h-3 w-32" />
          <div className="flex flex-col gap-3.5">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="grid grid-cols-[1fr_72px_1fr] items-center gap-4">
                <div className="flex items-center justify-end gap-3">
                  <Skeleton className="h-3.5 w-12" />
                  <Skeleton className="h-2 w-full max-w-[260px]" />
                </div>
                <Skeleton className="mx-auto h-3 w-10" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-2 w-full max-w-[260px]" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
