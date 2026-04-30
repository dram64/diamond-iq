import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatBattles } from './StatBattles';
import { judgeFixture, ohtaniFixture } from './__test-fixtures__';

describe('StatBattles', () => {
  it('renders cards for both hitter and pitcher stats — pitcher cards still appear with a "no comparison" placeholder for the hitter-only player', () => {
    render(<StatBattles a={judgeFixture()} b={ohtaniFixture()} />);
    // Hitter labels.
    expect(screen.getByText('Avg EV')).toBeInTheDocument();
    expect(screen.getByText('xwOBA')).toBeInTheDocument();
    // Pitcher labels DO render even though Judge has no pitching block.
    expect(screen.getByText('Fastball velo')).toBeInTheDocument();
    expect(screen.getByText('xERA')).toBeInTheDocument();
    // Judge's pitcher rows show "no comparison" in the missing-side cells.
    expect(screen.getAllByText(/no comparison/i).length).toBeGreaterThan(0);
  });

  it('shows both player names on each comparable card', () => {
    render(<StatBattles a={judgeFixture()} b={ohtaniFixture()} />);
    expect(screen.getAllByText('Aaron Judge').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shohei Ohtani').length).toBeGreaterThan(0);
  });

  it('renders a delta badge for stats where both players have values', () => {
    render(<StatBattles a={judgeFixture()} b={ohtaniFixture()} />);
    // At least one "Δ" badge shows up — the avg EV gap between Judge (94.7)
    // and Ohtani (95.5) is 0.8.
    expect(screen.getAllByText(/^Δ /).length).toBeGreaterThan(0);
  });
});
