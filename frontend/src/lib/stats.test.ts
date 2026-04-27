import { describe, expect, it } from 'vitest';

import { formatStat } from './stats';

describe('formatStat', () => {
  it('passes through API-formatted strings unchanged', () => {
    expect(formatStat('avg', '.300')).toBe('.300');
    expect(formatStat('era', '3.50')).toBe('3.50');
  });

  it('formats woba to 3 decimals with leading zero stripped', () => {
    expect(formatStat('woba', 0.399)).toBe('.399');
    expect(formatStat('woba', 0.42)).toBe('.420');
  });

  it('formats fip to 2 decimals', () => {
    expect(formatStat('fip', 3.669)).toBe('3.67');
  });

  it('rounds ops_plus to integer', () => {
    expect(formatStat('ops_plus', 148.404)).toBe('148');
    expect(formatStat('ops_plus', 99.6)).toBe('100');
  });

  it('formats counting stats as integer', () => {
    expect(formatStat('home_runs', 25)).toBe('25');
    expect(formatStat('strikeouts', 70)).toBe('70');
  });

  it('returns em-dash for null/undefined', () => {
    expect(formatStat('woba', null)).toBe('—');
    expect(formatStat('avg', undefined)).toBe('—');
  });
});
