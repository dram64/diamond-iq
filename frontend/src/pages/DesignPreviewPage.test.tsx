import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

import { DesignPreviewPage } from './DesignPreviewPage';
import { makeQueryWrapper } from '@/test/queryWrapper';
import {
  judgeFixture,
  ohtaniFixture,
} from '@/components/design-preview/__test-fixtures__';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function comparePayload() {
  return {
    data: { players: [judgeFixture(), ohtaniFixture()] },
    meta: { season: 2026, timestamp: 'x', cache_max_age_seconds: 300 },
  };
}

function renderPage(ui: ReactElement) {
  const { Wrapper } = makeQueryWrapper();
  return render(
    <MemoryRouter initialEntries={['/design-preview']}>
      <Wrapper>{ui}</Wrapper>
    </MemoryRouter>,
  );
}

describe('DesignPreviewPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the private-preview banner + page header', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderPage(<DesignPreviewPage />);
    expect(screen.getByText(/private preview route/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stat-display treatments/i })).toBeInTheDocument();
  });

  it('fires /api/players/compare with Judge + Ohtani ids on mount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(comparePayload()));
    renderPage(<DesignPreviewPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('592450');
    expect(url).toContain('660271');
  });

  it('renders all four treatment headings after data resolves', async () => {
    fetchMock.mockResolvedValue(jsonResponse(comparePayload()));
    renderPage(<DesignPreviewPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /percentile rankings/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: /head-to-head divergence/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stat battles/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /profile shape/i })).toBeInTheDocument();
  });

  it('renders error banner with retry on API failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'oops', message: 'down' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderPage(<DesignPreviewPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    );
  });
});
