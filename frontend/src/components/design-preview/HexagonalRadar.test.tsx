import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HexagonalRadar } from './HexagonalRadar';
import { judgeFixture, ohtaniFixture } from './__test-fixtures__';

describe('HexagonalRadar', () => {
  it('renders the legend with both player names', () => {
    render(<HexagonalRadar a={judgeFixture()} b={ohtaniFixture()} />);
    expect(screen.getByText('Aaron Judge')).toBeInTheDocument();
    expect(screen.getByText('Shohei Ohtani')).toBeInTheDocument();
  });

  it('renders all 6 hitter axis labels on the hex', () => {
    render(<HexagonalRadar a={judgeFixture()} b={ohtaniFixture()} />);
    expect(screen.getByText('Avg EV')).toBeInTheDocument();
    expect(screen.getByText('Hard-hit %')).toBeInTheDocument();
    expect(screen.getByText('Barrel %')).toBeInTheDocument();
    expect(screen.getByText('xwOBA')).toBeInTheDocument();
    expect(screen.getByText('Sprint speed')).toBeInTheDocument();
    expect(screen.getByText('OPS')).toBeInTheDocument();
  });

  it('shows the default tooltip prompt when no axis is hovered', () => {
    render(<HexagonalRadar a={judgeFixture()} b={ohtaniFixture()} />);
    expect(
      screen.getByText(/hover any axis dot for both players' values/i),
    ).toBeInTheDocument();
  });
});
