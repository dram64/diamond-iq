/**
 * useHardestHit — fetch the day's hardest-hit balls for a YYYY-MM-DD date.
 *
 * The Phase 5L cron runs at 09:45 UTC and ingests yesterday's Final games.
 * Today's partition is therefore not populated until tomorrow's cron, so
 * the home-page "Stat of the Day · Hardest-hit balls" card defaults to
 * yesterday — a 24-hour-old recap is the freshest available data and the
 * editorial framing already reads as "the day's standout contact."
 *
 * staleTime is 1 hour (matches Phase 5L Cache-Control). The data is
 * static-after-publish per date, so window-focus refetch is unnecessary.
 *
 * 503 handling: when the partition is empty the API returns 503 with
 * error.code="data_not_yet_available". The hook surfaces it as `isError`
 * with `error.status === 503`, and the component branches on that into
 * a clean "no data yet" empty state instead of a retry-on-fail UI.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { ApiError, fetchHardestHit } from '@/lib/api';
import { yesterdayUtcDate } from '@/lib/dateUtils';
import type { HardestHitResponse } from '@/types/hardestHit';

const STALE_TIME_MS = 3_600_000; // 1 hour — matches Phase 5L Cache-Control

export function useHardestHit(
  date: string = yesterdayUtcDate(),
  limit?: number,
): UseQueryResult<HardestHitResponse, ApiError> {
  return useQuery<HardestHitResponse, ApiError>({
    queryKey: ['hardest-hit', date, limit ?? null] as const,
    queryFn: ({ signal }) => fetchHardestHit(date, limit, { signal }),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
