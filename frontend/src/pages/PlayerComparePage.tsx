/**
 * PlayerComparePage — full-page side-by-side comparison for two MLB players.
 *
 * Picker mechanics:
 *   1. Featured-matchup quick-pick chips (FEATURED_COMPARISONS) — primary
 *      discovery surface; one click loads two real, qualified-pool players.
 *   2. URL `?ids=<personIdA>,<personIdB>` — power-user / shareable / direct-
 *      link access to any pair.
 *
 * A free-text "/api/players/search?q=…" backend endpoint is a Phase 6
 * enhancement; today's URL-as-state pattern keeps this page deployable with
 * the existing /api/players/compare contract.
 *
 * Display blocks (mirrors CompareStrip's data semantics, expanded for a
 * full-page layout):
 *   - Both players are hitters → hitting block.
 *   - Both players are pitchers → pitching block.
 *   - One hitter + one pitcher → "Player types incomparable" fallback.
 *   - One/both with no qualified-pool stats → "Insufficient season data"
 *     fallback.
 *
 * Visual delta indicators reuse the per-row max-with-5%-headroom pattern
 * from CompareStrip; ascending stats (ERA/WHIP/FIP) flip the bar so
 * visually-longer = better stays the user's mental model.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Card } from '@/components/primitives/Card';
import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { PlayerHeadshot } from '@/components/PlayerHeadshot';
import { useCompare } from '@/hooks/useCompare';
import { FEATURED_COMPARISONS, type FeaturedComparison } from '@/lib/featuredComparisons';
import { getMlbTeam } from '@/lib/mlbTeams';
import {
  compareStatBetter,
  formatStat,
  isAscendingStat,
  parseStatNumber,
} from '@/lib/stats';
import type { ComparePlayer } from '@/types/compare';

type StatGroup = 'hitting' | 'pitching';

const HITTING_ROWS: readonly { token: string; label: string }[] = [
  { token: 'avg', label: 'AVG' },
  { token: 'home_runs', label: 'HR' },
  { token: 'rbi', label: 'RBI' },
  { token: 'ops', label: 'OPS' },
  { token: 'woba', label: 'wOBA' },
  { token: 'ops_plus', label: 'OPS+' },
];

const PITCHING_ROWS: readonly { token: string; label: string }[] = [
  { token: 'era', label: 'ERA' },
  { token: 'strikeouts', label: 'K' },
  { token: 'whip', label: 'WHIP' },
  { token: 'fip', label: 'FIP' },
  { token: 'wins', label: 'W' },
  { token: 'saves', label: 'SV' },
];

function parseIdsParam(raw: string | null): readonly number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function PlayerComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsFromUrl = useMemo(() => parseIdsParam(searchParams.get('ids')), [searchParams]);

  // Default to the first curated matchup so the page is never blank on first
  // load. The URL stays clean (no ?ids=) until the user picks something.
  const fallbackIds = FEATURED_COMPARISONS[0]?.playerIds ?? ([] as readonly number[]);
  const ids = idsFromUrl.length === 2 ? idsFromUrl : fallbackIds;

  const activeMatchup = FEATURED_COMPARISONS.find(
    (m) => m.playerIds[0] === ids[0] && m.playerIds[1] === ids[1],
  );

  const compare = useCompare(ids);

  function selectMatchup(m: FeaturedComparison) {
    setSearchParams({ ids: m.playerIds.join(',') });
  }

  return (
    <section>
      <div className="kicker mb-2">Compare</div>
      <h1 className="text-2xl font-bold tracking-tight text-paper-2">Player Compare</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-paper-4">
        Two MLB players, side by side. Pick a featured matchup below or share
        any pair with{' '}
        <code className="mono rounded-s bg-surface-3 px-1.5 py-0.5 text-[11.5px]">
          ?ids=&lt;a&gt;,&lt;b&gt;
        </code>{' '}
        in the URL.
      </p>

      <div className="mt-6">
        <MatchupPicker activeId={activeMatchup?.id ?? ''} onSelect={selectMatchup} />
      </div>

      <div className="mt-4">
        {compare.isLoading ? (
          <CompareSkeleton />
        ) : compare.isError ? (
          <ErrorBanner
            title="Couldn't load comparison"
            message={compare.error?.message ?? 'Please try again in a moment.'}
            onRetry={() => void compare.refetch()}
          />
        ) : (
          <ComparePanel
            subtitle={activeMatchup?.subtitle ?? 'Side-by-side season stats'}
            players={compare.data?.data.players ?? []}
          />
        )}
      </div>
    </section>
  );
}

interface MatchupPickerProps {
  activeId: string;
  onSelect: (m: FeaturedComparison) => void;
}

function MatchupPicker({ activeId, onSelect }: MatchupPickerProps) {
  return (
    <div
      className="-mx-1 flex flex-wrap gap-2 px-1"
      role="tablist"
      aria-label="Featured player comparisons"
    >
      {FEATURED_COMPARISONS.map((m) => {
        const active = m.id === activeId;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(m)}
            className={[
              'whitespace-nowrap rounded-s px-3 py-1.5 text-[12px] font-semibold transition-colors',
              active
                ? 'bg-accent text-white'
                : 'bg-surface-2 text-paper-3 hover:bg-surface-3',
            ].join(' ')}
          >
            {m.title}
          </button>
        );
      })}
    </div>
  );
}

interface ComparePanelProps {
  subtitle: string;
  players: readonly ComparePlayer[];
}

function ComparePanel({ subtitle, players }: ComparePanelProps) {
  if (players.length < 2) {
    return (
      <Card>
        <div className="px-2 py-10 text-center text-[13px] text-paper-4">
          Comparison data unavailable.
        </div>
      </Card>
    );
  }

  const [a, b] = players;
  const aHas = { hitting: a.hitting != null, pitching: a.pitching != null };
  const bHas = { hitting: b.hitting != null, pitching: b.pitching != null };

  let group: StatGroup | null = null;
  if (aHas.hitting && bHas.hitting) group = 'hitting';
  else if (aHas.pitching && bHas.pitching) group = 'pitching';

  return (
    <Card>
      <Header subtitle={subtitle} a={a} b={b} />
      {group === null ? (
        <div className="px-2 py-10 text-center text-[13px] text-paper-4">
          {!(aHas.hitting || aHas.pitching) || !(bHas.hitting || bHas.pitching)
            ? 'Insufficient season data for at least one player.'
            : 'Player types incomparable (one hitter, one pitcher).'}
        </div>
      ) : (
        <StatBlock
          a={a}
          b={b}
          group={group}
          rows={group === 'hitting' ? HITTING_ROWS : PITCHING_ROWS}
        />
      )}
    </Card>
  );
}

interface HeaderProps {
  subtitle: string;
  a: ComparePlayer;
  b: ComparePlayer;
}

function Header({ subtitle, a, b }: HeaderProps) {
  return (
    <>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-paper-4">
        {subtitle}
      </div>
      <div className="grid grid-cols-1 gap-6 border-b border-hairline-strong pb-5 sm:grid-cols-2">
        <Side player={a} accent />
        <Side player={b} />
      </div>
    </>
  );
}

interface SideProps {
  player: ComparePlayer;
  accent?: boolean;
}

function Side({ player, accent = false }: SideProps) {
  const teamId =
    (player.hitting?.team_id as number | undefined) ??
    (player.pitching?.team_id as number | undefined);
  const team = teamId != null ? getMlbTeam(teamId) : undefined;
  const subtitle = [team?.locationName, player.metadata.primary_position_abbr]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-4">
      <PlayerHeadshot
        playerId={player.metadata.person_id}
        playerName={player.metadata.full_name}
        size="lg"
      />
      <div className="flex flex-col gap-1">
        <div className={['kicker', accent ? 'text-accent' : 'text-paper-4'].join(' ')}>
          {subtitle || '—'}
        </div>
        <div className="text-2xl font-bold -tracking-[0.01em] text-paper">
          {player.metadata.full_name}
        </div>
        {player.metadata.bat_side && player.metadata.pitch_hand && (
          <div className="mono text-[11px] text-paper-4">
            B/T: {player.metadata.bat_side} / {player.metadata.pitch_hand}
            {player.metadata.height ? ` · ${player.metadata.height}` : ''}
            {player.metadata.weight ? ` · ${player.metadata.weight} lb` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatBlockProps {
  a: ComparePlayer;
  b: ComparePlayer;
  group: StatGroup;
  rows: readonly { token: string; label: string }[];
}

function StatBlock({ a, b, group, rows }: StatBlockProps) {
  const aStats = (group === 'hitting' ? a.hitting : a.pitching) as Record<string, unknown>;
  const bStats = (group === 'hitting' ? b.hitting : b.pitching) as Record<string, unknown>;
  return (
    <div className="mt-5 flex flex-col gap-3.5">
      {rows.map((row) => (
        <StatRow
          key={row.token}
          stat={row.token}
          label={row.label}
          valueA={aStats[row.token] as number | string | undefined}
          valueB={bStats[row.token] as number | string | undefined}
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
  const winner = compareStatBetter(stat, valueA, valueB);
  const ascending = isAscendingStat(stat);
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

function CompareSkeleton() {
  return (
    <Card>
      <Skeleton className="mb-3 h-3 w-40" />
      <div className="mb-5 grid grid-cols-1 gap-6 border-b border-hairline-strong pb-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_72px_1fr] items-center gap-4">
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
  );
}
