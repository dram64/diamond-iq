/**
 * useTeamCompare — fetch a side-by-side comparison for 2-4 team IDs.
 *
 * Disabled (no fetch fired) when the id count is outside [2, 4] to match the
 * Phase 5L API contract — the backend would 400 on 0/1/5+ ids anyway, but
 * skipping the call entirely keeps DevTools clean.
 *
 * staleTime is 15 minutes to match the backend's
 * `Cache-Control: max-age=900` for /api/teams/compare.
 */

import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ApiError, fetchTeamCompare } from '@/lib/api';
import type { TeamCompareResponse } from '@/types/teamStats';

const STALE_TIME_MS = 900_000; // 15 minutes — matches Phase 5L Cache-Control
const MIN_IDS = 2;
const MAX_IDS = 4;

export function useTeamCompare(
  ids: readonly number[],
): UseQueryResult<TeamCompareResponse, ApiError> {
  // Sort the cache key so [147, 121] and [121, 147] share a single cached
  // entry — order doesn't change the visual result beyond which team renders
  // on the left.
  const sortedIds = useMemo(() => [...ids].sort((a, b) => a - b), [ids]);
  const enabled = sortedIds.length >= MIN_IDS && sortedIds.length <= MAX_IDS;

  return useQuery<TeamCompareResponse, ApiError>({
    queryKey: ['teamCompare', ...sortedIds] as const,
    queryFn: ({ signal }) => fetchTeamCompare(ids, { signal }),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
    enabled,
  });
}
