import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PercentileRings } from './PercentileRings';
import { judgeFixture, ohtaniFixture } from './__test-fixtures__';

describe('PercentileRings', () => {
  it('renders all 8 hitter stat cards', () => {
    render(<PercentileRings a={judgeFixture()} b={ohtaniFixture()} />);
    expect(screen.getByText('Avg EV')).toBeInTheDocument();
    expect(screen.getByText('Max EV')).toBeInTheDocument();
    expect(screen.getByText('Barrel %')).toBeInTheDocument();
    expect(screen.getByText('Hard-hit %')).toBeInTheDocument();
    expect(screen.getByText('xwOBA')).toBeInTheDocument();
    expect(screen.getByText('Sprint speed')).toBeInTheDocument();
    expect(screen.getByText('OPS')).toBeInTheDocument();
    expect(screen.getByText('Sweet spot %')).toBeInTheDocument();
  });

  it('formats Judge avg EV (94.7) and shows it in the document', () => {
    render(<PercentileRings a={judgeFixture()} b={ohtaniFixture()} />);
    expect(screen.getAllByText('94.7').length).toBeGreaterThan(0);
  });

  it('renders an em-dash when statcast hitting is null', () => {
    const sparse = { ...judgeFixture(), statcast: null };
    render(<PercentileRings a={sparse} b={ohtaniFixture()} />);
    // At least one ring shows "—" for the missing values.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
