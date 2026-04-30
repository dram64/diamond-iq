import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFeaturedMatchup } from './useFeaturedMatchup';
import { makeQueryWrapper } from '@/test/queryWrapper';
import type { FeaturedMatchupResponse } from '@/types/featuredMatchup';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function payload(): FeaturedMatchupResponse {
  return {
    data: {
      date: '2026-04-30',
      player_ids: [592450, 670541],
      players: [
        {
          person_id: 592450,
          full_name: 'Aaron Judge',
          team_id: 147,
          primary_position_abbr: 'RF',
          woba: '.420',
        },
        {
          person_id: 670541,
          full_name: 'Yordan Alvarez',
          team_id: 117,
          primary_position_abbr: 'DH',
          woba: '.450',
        },
      ],
      selection_reason: 'top-10 wOBA, deterministic by date',
    },
    meta: { season: 2026, timestamp: 'x', cache_max_age_seconds: 3600 },
  };
}

describe('useFeaturedMatchup', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the matchup payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse(payload()));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useFeaturedMatchup(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.player_ids).toEqual([592450, 670541]);
  });

  it('reports isError on a 503 response', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'data_not_yet_available', message: 'no rows' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useFeaturedMatchup(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(503);
  });
});
