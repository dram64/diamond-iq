/**
 * useFeaturedGame — Phase 8.5 Track 1 hook for the home-page hero.
 *
 * Fetches /api/games/featured. The route returns 503 with code
 * "off_day" when MLB has no games scheduled (off-season, All-Star
 * break, etc.) or "data_not_yet_available" when the upstream MLB API
 * hiccups; both surface as `isError` here, and the hero component
 * branches on `error.details?.code === "off_day"` to render the
 * banner versus a generic retry surface.
 *
 * staleTime is 3 minutes (matches the route's Cache-Control), and
 * refetch-on-window-focus is enabled so a status drift from
 * Preview → Live → Final is picked up when the user re-engages.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ApiError, fetchFeaturedGame } from '@/lib/api';
import type { FeaturedGameResponse } from '@/types/featuredGame';

const STALE_TIME_MS = 180_000; // 3 minutes — matches Cache-Control max-age

export function useFeaturedGame(): UseQueryResult<FeaturedGameResponse, ApiError> {
  return useQuery<FeaturedGameResponse, ApiError>({
    queryKey: ['featuredGame'] as const,
    queryFn: ({ signal }) => fetchFeaturedGame({ signal }),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
    // The route already returns 503 cleanly for the two known
    // miss-paths (off-day, MLB hiccup) — don't retry, surface fast.
    retry: false,
  });
}
