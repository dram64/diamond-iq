/**
 * useCompare — fetch a side-by-side comparison for 2-4 player IDs.
 *
 * Disabled (no fetch fired) when the id count is outside [2, 4] to
 * match the Phase 5E API contract — the backend would 400 on 0/1/5+
 * ids anyway, but skipping the call entirely keeps DevTools clean
 * and React Query's error count meaningful.
 *
 * staleTime is 5 minutes to match the API's `Cache-Control:
 * max-age=300` for /api/players/compare.
 */

import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ApiError, fetchCompare } from '@/lib/api';
import type { CompareResponse } from '@/types/compare';

const STALE_TIME_MS = 300_000; // 5 minutes — matches Phase 5E Cache-Control
const MIN_IDS = 2;
const MAX_IDS = 4;

export function useCompare(
  ids: readonly number[],
): UseQueryResult<CompareResponse, ApiError> {
  // Sort the cache key so [592450, 670541] and [670541, 592450] share
  // a single cached entry — order doesn't change the visual result
  // beyond which player renders on the left.
  const sortedIds = useMemo(() => [...ids].sort((a, b) => a - b), [ids]);
  const enabled = sortedIds.length >= MIN_IDS && sortedIds.length <= MAX_IDS;

  return useQuery<CompareResponse, ApiError>({
    queryKey: ['compare', ...sortedIds] as const,
    queryFn: ({ signal }) => fetchCompare(ids, { signal }),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
    enabled,
  });
}
