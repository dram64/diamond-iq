/**
 * Headline scoreboard hook.
 *
 * Fetches the API for both today's UTC date and yesterday's UTC date in
 * parallel (the dual-date strategy that pairs with the backend's
 * dual-date ingest, see backend ADR 004). Results are merged and
 * deduplicated by `game_pk`, then categorized by status for the home
 * page sections.
 *
 * Loading is "true" only when both queries are loading (initial mount).
 * isError is "true" only when both queries failed — if one date errors
 * but the other succeeds, we treat that as partial success and surface
 * whatever we got. Same pattern as the backend's ingest handler.
 */

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { ApiError, fetchScoreboard } from '@/lib/api';
import { mergeScoreboards } from '@/lib/adapters';
import { todayUtcDate, yesterdayUtcDate } from '@/lib/dateUtils';
import type { ScoreboardResponse } from '@/types/api';
import type { AppGame } from '@/types/app';

export interface UseScoreboardResult {
  /** Every live/final/scheduled/preview/postponed game we know about, deduped by game_pk and sorted by start time. */
  games: AppGame[];
  liveGames: AppGame[];
  finalGames: AppGame[];
  scheduledGames: AppGame[];
  postponedGames: AppGame[];

  /** True only on first mount when neither query has resolved yet. */
  isLoading: boolean;
  /** True only when BOTH date queries failed. One success ⇒ partial-success render path. */
  isError: boolean;
  /** First error encountered, if any. */
  error: ApiError | null;
  /** True any time at least one query is fetching (including background refetches). */
  isFetching: boolean;
  /** Manually re-run both queries. */
  refetch: () => void;
  /** Wall-clock ms of the most recent successful fetch from either query. */
  lastUpdatedAt: number | null;
}

const STALE_TIME_MS = 30_000;
const REFETCH_INTERVAL_MS = 60_000;

export function useScoreboard(): UseScoreboardResult {
  // Memoize so re-renders within the same UTC day don't churn query keys.
  const dates = useMemo(() => {
    const now = new Date();
    return [yesterdayUtcDate(now), todayUtcDate(now)];
  }, []);

  const queries = useQueries({
    queries: dates.map((date) => ({
      queryKey: ['scoreboard', date] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchScoreboard(date, { signal }),
      staleTime: STALE_TIME_MS,
      refetchInterval: REFETCH_INTERVAL_MS,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      // retry: 2 with exponential backoff — set on the QueryClient default
      // in main.tsx so tests can opt out via their wrapper.
    })),
  });

  return useMemo<UseScoreboardResult>(() => {
    const successfulResponses: ScoreboardResponse[] = queries
      .filter((q): q is typeof q & { data: ScoreboardResponse } => q.isSuccess && q.data != null)
      .map((q) => q.data);

    const games: AppGame[] =
      successfulResponses.length > 0 ? mergeScoreboards(...successfulResponses) : [];

    const allLoading = queries.every((q) => q.isLoading);
    const allError = queries.every((q) => q.isError);
    const anyFetching = queries.some((q) => q.isFetching);

    const firstError =
      (queries.find((q) => q.error != null)?.error as ApiError | undefined) ?? null;

    const lastUpdatedTimes = queries
      .map((q) => q.dataUpdatedAt)
      .filter((t): t is number => typeof t === 'number' && t > 0);
    const lastUpdatedAt = lastUpdatedTimes.length > 0 ? Math.max(...lastUpdatedTimes) : null;

    const refetch = () => {
      for (const q of queries) {
        void q.refetch();
      }
    };

    return {
      games,
      liveGames: games.filter((g) => g.status === 'live'),
      finalGames: games.filter((g) => g.status === 'final'),
      scheduledGames: games.filter(
        (g) => g.status === 'scheduled' || g.status === 'preview',
      ),
      postponedGames: games.filter((g) => g.status === 'postponed'),
      isLoading: allLoading,
      isError: allError,
      error: firstError,
      isFetching: anyFetching,
      refetch,
      lastUpdatedAt,
    };
  }, [queries]);
}
