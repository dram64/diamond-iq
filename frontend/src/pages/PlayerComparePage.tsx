/**
 * PlayerComparePage — full-page side-by-side comparison for 2-4 MLB players.
 *
 * Phase 6.1 picker rewrite (Bug 3):
 *   - Replaces the curated 4-matchup MatchupPicker with PlayerSearchPicker:
 *     a typeahead search input (backed by /api/players/search) that lets
 *     the user pick any of the ~779 ingested players, plus selected-player
 *     chips with × remove and a "Quick picks" preset row underneath.
 *   - URL `?ids=<a>,<b>[,<c>,<d>]` is still the source of truth so deep
 *     links and the navbar typeahead keep working.
 *
 * Phase 6 carryover:
 *   - Supports 2..4 players. Layout adapts via responsive auto-fit grid.
 *   - Accolades chip row under each player's name (PlayerAwardsBlock from
 *     the AWARDS#GLOBAL partition surfaced through /api/players/compare).
 *
 * Display logic for N players:
 *   - Stat block renders if at least 2 players have the dominant group
 *     (hitting if more hitters than pitchers among non-null sides; same
 *     for pitching). Players missing that group are listed in a small
 *     "stat block unavailable" footer instead of being dropped silently.
 *
 * Per-row visual delta: the bar's max scales to the row's best value with
 * 5% headroom; ascending stats (ERA / WHIP / FIP) flip the fill so
 * visually-longer = better stays consistent.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AccoladesRow } from '@/components/AccoladesRow';
import { PlayerSearchPicker } from '@/components/PlayerSearchPicker';
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

const MIN_IDS = 2;
const MAX_IDS = 4;

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

  // Default to the first curated matchup so the page renders something on
  // first paint even with no URL state. We accept 2..4 ids from the URL;
  // anything outside that range falls back to the curated default.
  const fallbackIds = FEATURED_COMPARISONS[0]?.playerIds ?? ([] as readonly number[]);
  const ids =
    idsFromUrl.length >= MIN_IDS && idsFromUrl.length <= MAX_IDS ? idsFromUrl : fallbackIds;

  const activeMatchup = FEATURED_COMPARISONS.find(
    (m) =>
      ids.length === 2 && m.playerIds[0] === ids[0] && m.playerIds[1] === ids[1],
  );

  const compare = useCompare(ids);

  // Selected-chip display lives off the compare-response payload — this means
  // newly added players show "Player #<id>" until the next fetch resolves
  // (~one render). Pre-fetching metadata in the picker would require a
  // separate API call per slot; we accept the brief flash for code simplicity.
  const selectedDisplay = useMemo(() => {
    const map = new Map<
      number,
      { person_id: number; full_name?: string | null; primary_position_abbr?: string | null }
    >();
    for (const p of compare.data?.data.players ?? []) {
      map.set(p.metadata.person_id, {
        person_id: p.metadata.person_id,
        full_name: p.metadata.full_name,
        primary_position_abbr: p.metadata.primary_position_abbr,
      });
    }
    return map;
  }, [compare.data]);

  function setIds(next: readonly number[]) {
    setSearchParams({ ids: next.join(',') });
  }
  function selectMatchup(m: FeaturedComparison) {
    setIds(m.playerIds);
  }
  function addId(personId: number) {
    if (ids.includes(personId)) return;
    if (ids.length >= MAX_IDS) return;
    setIds([...ids, personId]);
  }
  function removeId(personId: number) {
    if (ids.length <= MIN_IDS) return;
    setIds(ids.filter((id) => id !== personId));
  }

  return (
    <section>
      <div className="kicker mb-2">Compare</div>
      <h1 className="text-2xl font-bold tracking-tight text-paper-2">Player Compare</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-paper-4">
        Compare {MIN_IDS}–{MAX_IDS} MLB players side by side. Search any of the ~779 ingested
        players below, or share a pair with{' '}
        <code className="mono rounded-s bg-surface-3 px-1.5 py-0.5 text-[11.5px]">
          ?ids=&lt;a&gt;,&lt;b&gt;
        </code>{' '}
        in the URL.
      </p>

      <div className="mt-6">
        <PlayerSearchPicker
          selectedIds={ids}
          selectedDisplay={selectedDisplay}
          minIds={MIN_IDS}
          maxIds={MAX_IDS}
          onAdd={addId}
          onRemove={removeId}
          onPreset={selectMatchup}
          activePresetId={activeMatchup?.id ?? ''}
        />
      </div>

      <div className="mt-5">
        {compare.isLoading ? (
          <CompareSkeleton playerCount={ids.length} />
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
            onRemove={ids.length > MIN_IDS ? removeId : undefined}
          />
        )}
      </div>
    </section>
  );
}

interface ComparePanelProps {
  subtitle: string;
  players: readonly ComparePlayer[];
  onRemove?: (personId: number) => void;
}

function ComparePanel({ subtitle, players, onRemove }: ComparePanelProps) {
  if (players.length < MIN_IDS) {
    return (
      <Card>
        <div className="px-2 py-10 text-center text-[13px] text-paper-4">
          Comparison data unavailable.
        </div>
      </Card>
    );
  }

  // Decide the dominant stat group: whichever group ≥ 2 players have data
  // for. Ties favor hitting (more populous on the dashboard).
  const hitterCount = players.filter((p) => p.hitting != null).length;
  const pitcherCount = players.filter((p) => p.pitching != null).length;
  let group: StatGroup | null = null;
  if (hitterCount >= 2 && hitterCount >= pitcherCount) group = 'hitting';
  else if (pitcherCount >= 2) group = 'pitching';

  const eligible = players.filter(
    (p) => (group === 'hitting' && p.hitting != null) || (group === 'pitching' && p.pitching != null),
  );
  const ineligible = players.filter((p) => !eligible.includes(p));

  return (
    <Card>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-paper-4">
        {subtitle}
      </div>

      <div
        className="grid gap-6 border-b border-hairline-strong pb-5"
        style={{
          gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`,
        }}
      >
        {players.map((p, i) => (
          <Side key={p.person_id} player={p} accent={i === 0} onRemove={onRemove} />
        ))}
      </div>

      {group === null ? (
        <div className="px-2 py-10 text-center text-[13px] text-paper-4">
          Player types incomparable — at least two players must share a hitting or pitching
          season-stats block.
        </div>
      ) : (
        <>
          <StatBlock
            players={eligible}
            group={group}
            rows={group === 'hitting' ? HITTING_ROWS : PITCHING_ROWS}
          />
          {ineligible.length > 0 && (
            <div className="mt-5 rounded-m bg-surface-2 px-4 py-3 text-[12px] text-paper-4">
              <span className="font-semibold">Stat block omits:</span>{' '}
              {ineligible.map((p) => p.metadata.full_name).join(', ')} — no {group} block on file.
            </div>
          )}
        </>
      )}
    </Card>
  );
}

interface SideProps {
  player: ComparePlayer;
  accent?: boolean;
  onRemove?: (personId: number) => void;
}

function Side({ player, accent = false, onRemove }: SideProps) {
  const teamId =
    (player.hitting?.team_id as number | undefined) ??
    (player.pitching?.team_id as number | undefined);
  const team = teamId != null ? getMlbTeam(teamId) : undefined;
  const subtitle = [team?.locationName, player.metadata.primary_position_abbr]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <PlayerHeadshot
          playerId={player.metadata.person_id}
          playerName={player.metadata.full_name}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className={['kicker', accent ? 'text-accent' : 'text-paper-4'].join(' ')}>
            {subtitle || '—'}
          </div>
          <div className="truncate text-xl font-bold -tracking-[0.01em] text-paper">
            {player.metadata.full_name}
          </div>
          {player.metadata.bat_side && player.metadata.pitch_hand && (
            <div className="mono text-[11px] text-paper-4">
              B/T: {player.metadata.bat_side} / {player.metadata.pitch_hand}
              {player.metadata.height ? ` · ${player.metadata.height}` : ''}
            </div>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(player.metadata.person_id)}
            aria-label={`Remove ${player.metadata.full_name}`}
            className="rounded-s border border-hairline px-1.5 py-0.5 text-[11px] text-paper-4 hover:border-bad/50 hover:text-bad"
          >
            ×
          </button>
        )}
      </div>
      <AccoladesRow awards={player.awards ?? null} />
    </div>
  );
}

interface StatBlockProps {
  players: readonly ComparePlayer[];
  group: StatGroup;
  rows: readonly { token: string; label: string }[];
}

function StatBlock({ players, group, rows }: StatBlockProps) {
  return (
    <div className="mt-5 flex flex-col gap-3.5">
      {rows.map((row) => (
        <StatRow key={row.token} stat={row.token} label={row.label} group={group} players={players} />
      ))}
    </div>
  );
}

interface StatRowProps {
  stat: string;
  label: string;
  group: StatGroup;
  players: readonly ComparePlayer[];
}

function StatRow({ stat, label, group, players }: StatRowProps) {
  const ascending = isAscendingStat(stat);

  // Per-row max for bar scaling. 5 % headroom keeps the longest bar from
  // pegging at 100 %. For ascending stats, we still scale by max value so
  // the visual ordering stays stable — the inversion happens at fill-time.
  const numericValues: number[] = [];
  for (const p of players) {
    const block = (group === 'hitting' ? p.hitting : p.pitching) as Record<string, unknown> | null;
    const v = parseStatNumber(block?.[stat] as number | string | undefined);
    if (v !== null) numericValues.push(v);
  }
  const max = numericValues.length > 0 ? Math.max(...numericValues) * 1.05 || 1 : 1;

  // Pick the winner across the row.
  let winnerIdx: number | null = null;
  for (let i = 0; i < players.length; i++) {
    const block = (group === 'hitting' ? players[i].hitting : players[i].pitching) as
      | Record<string, unknown>
      | null;
    const v = block?.[stat] as number | string | undefined;
    if (v == null) continue;
    if (winnerIdx === null) {
      winnerIdx = i;
      continue;
    }
    const prevBlock = (group === 'hitting' ? players[winnerIdx].hitting : players[winnerIdx].pitching) as
      | Record<string, unknown>
      | null;
    const prev = prevBlock?.[stat] as number | string | undefined;
    const cmp = compareStatBetter(stat, v, prev);
    if (cmp === 'a') winnerIdx = i;
  }

  return (
    <div
      className="grid items-center gap-3"
      style={{ gridTemplateColumns: `60px repeat(${players.length}, minmax(0, 1fr))` }}
    >
      <span className="kicker text-[10.5px] text-paper-4">{label}</span>
      {players.map((p, i) => {
        const block = (group === 'hitting' ? p.hitting : p.pitching) as
          | Record<string, unknown>
          | null;
        const value = block?.[stat] as number | string | undefined;
        const num = parseStatNumber(value);
        const fill =
          num !== null
            ? ascending
              ? Math.max(0, max - num) / max
              : num / max
            : 0;
        const isWinner = winnerIdx === i;
        return (
          <div key={p.person_id} className="flex items-center gap-2">
            <div className="relative h-2 flex-1 overflow-hidden rounded-s bg-surface-3">
              <div
                className={[
                  'h-full transition-[width] duration-300',
                  isWinner ? 'bg-accent' : 'bg-paper-5',
                ].join(' ')}
                style={{ width: `${fill * 100}%` }}
              />
            </div>
            <span
              className={[
                'mono w-[52px] shrink-0 text-right text-[13px]',
                isWinner ? 'font-bold text-accent' : 'font-medium text-paper-3',
              ].join(' ')}
            >
              {formatStat(stat, value ?? null)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CompareSkeleton({ playerCount }: { playerCount: number }) {
  const cols = Math.max(MIN_IDS, Math.min(MAX_IDS, playerCount));
  return (
    <Card>
      <Skeleton className="mb-3 h-3 w-40" />
      <div
        className="mb-5 grid gap-6 border-b border-hairline-strong pb-5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </Card>
  );
}
