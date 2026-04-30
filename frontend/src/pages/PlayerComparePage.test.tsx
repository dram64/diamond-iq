import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

import { PlayerComparePage } from './PlayerComparePage';
import { makeQueryWrapper } from '@/test/queryWrapper';
import type { CompareResponse } from '@/types/compare';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function hitterPayload(): CompareResponse {
  return {
    data: {
      players: [
        {
          person_id: 592450,
          metadata: {
            person_id: 592450,
            full_name: 'Aaron Judge',
            primary_position_abbr: 'RF',
            bat_side: 'R',
            pitch_hand: 'R',
            height: '6\' 7"',
            weight: 282,
          },
          hitting: {
            team_id: 147,
            avg: '.230',
            home_runs: 10,
            rbi: 18,
            ops: '.929',
            woba: 0.399,
            ops_plus: 148,
          },
          pitching: null,
        },
        {
          person_id: 670541,
          metadata: {
            person_id: 670541,
            full_name: 'Yordan Alvarez',
            primary_position_abbr: 'DH',
          },
          hitting: {
            team_id: 117,
            avg: '.358',
            home_runs: 11,
            rbi: 26,
            ops: '1.220',
            woba: 0.503,
            ops_plus: 225,
          },
          pitching: null,
        },
      ],
    },
    meta: { season: 2026, timestamp: '2026-04-30T00:00:00Z', cache_max_age_seconds: 300 },
  };
}

function renderPage(ui: ReactElement, initialEntries: string[] = ['/compare-players']) {
  const { Wrapper } = makeQueryWrapper();
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Wrapper>{ui}</Wrapper>
    </MemoryRouter>,
  );
}

describe('PlayerComparePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the page header and featured-matchup picker', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderPage(<PlayerComparePage />);
    expect(screen.getByRole('heading', { name: /player compare/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /judge vs alvarez/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sale vs soriano/i })).toBeInTheDocument();
  });

  it('fires a default comparison fetch on mount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(hitterPayload()));
    renderPage(<PlayerComparePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/api/players/compare');
  });

  it('renders side-by-side hitter comparison on success with lg headshots', async () => {
    fetchMock.mockResolvedValue(jsonResponse(hitterPayload()));
    renderPage(<PlayerComparePage />);
    await waitFor(() => expect(screen.getByText('Aaron Judge')).toBeInTheDocument());
    expect(screen.getByText('Yordan Alvarez')).toBeInTheDocument();
    expect(screen.getByText('AVG')).toBeInTheDocument();
    expect(screen.getByText('wOBA')).toBeInTheDocument();
    const judgeImg = screen.getByAltText('Aaron Judge') as HTMLImageElement;
    expect(judgeImg.src).toContain('img.mlbstatic.com');
    expect(judgeImg.width).toBe(96); // size="lg"
  });

  it('reads ?ids= from the URL and calls the API with those ids', async () => {
    fetchMock.mockResolvedValue(jsonResponse(hitterPayload()));
    renderPage(<PlayerComparePage />, ['/compare-players?ids=545361,621566']);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('545361');
    expect(url).toContain('621566');
  });

  it('renders an error banner with retry on API failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'oops', message: 'down' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderPage(<PlayerComparePage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    );
  });

  it('clicking a different matchup tab triggers a new fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse(hitterPayload()));
    renderPage(<PlayerComparePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('tab', { name: /sale vs soriano/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain('519242');
    expect(secondUrl).toContain('667755');
  });
});
