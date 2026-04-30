import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DivergingBars } from './DivergingBars';
import { judgeFixture, ohtaniFixture } from './__test-fixtures__';

describe('DivergingBars', () => {
  it('shows both player names in the header row', () => {
    render(<DivergingBars a={judgeFixture()} b={ohtaniFixture()} />);
    expect(screen.getByText('Aaron Judge')).toBeInTheDocument();
    expect(screen.getByText('Shohei Ohtani')).toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('filters to stats where both players have values — pitcher stats are excluded for Judge-vs-Ohtani because Judge has no pitching block', () => {
    render(<DivergingBars a={judgeFixture()} b={ohtaniFixture()} />);
    // Hitter labels render.
    expect(screen.getByText('Avg EV')).toBeInTheDocument();
    expect(screen.getByText('xwOBA')).toBeInTheDocument();
    // Pitcher labels do NOT render — Judge has no pitching, so both-present
    // filter drops them.
    expect(screen.queryByText('Fastball velo')).toBeNull();
    expect(screen.queryByText('Whiff %')).toBeNull();
    expect(screen.queryByText('xERA')).toBeNull();
  });

  it('renders the empty-state message when no stats overlap', () => {
    const aOnly = { ...judgeFixture(), statcast: null };
    const bOnly = { ...ohtaniFixture(), statcast: null, hitting: null };
    render(<DivergingBars a={aOnly} b={bOnly} />);
    expect(screen.getByText(/no stats where both players have values/i)).toBeInTheDocument();
  });
});
