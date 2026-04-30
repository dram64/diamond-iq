import type { ComparePlayer } from '@/types/compare';

export function judgeFixture(): ComparePlayer {
  return {
    person_id: 592450,
    metadata: {
      person_id: 592450,
      full_name: 'Aaron Judge',
      primary_position_abbr: 'RF',
    },
    hitting: { team_id: 147, avg: '.290', home_runs: 12, ops: '.929' },
    pitching: null,
    statcast: {
      person_id: 592450,
      season: 2026,
      hitting: {
        xba: '.290',
        xslg: '.707',
        xwoba: '.466',
        avg_hit_speed: 94.7,
        max_hit_speed: 115.8,
        ev95_percent: 55.6,
        barrel_percent: 21.5,
        sweet_spot_percent: 38.9,
        sprint_speed: 26.8,
      },
      pitching: null,
      bat_tracking: null,
      batted_ball: null,
    },
  };
}

export function ohtaniFixture(): ComparePlayer {
  return {
    person_id: 660271,
    metadata: {
      person_id: 660271,
      full_name: 'Shohei Ohtani',
      primary_position_abbr: 'DH',
    },
    hitting: { team_id: 119, avg: '.310', home_runs: 14, ops: '1.020' },
    pitching: { team_id: 119, era: '3.20', strikeouts: 60, wins: 5 },
    statcast: {
      person_id: 660271,
      season: 2026,
      hitting: {
        xba: '.310',
        xslg: '.680',
        xwoba: '.452',
        avg_hit_speed: 95.5,
        max_hit_speed: 118.2,
        ev95_percent: 58.0,
        barrel_percent: 18.0,
        sweet_spot_percent: 35.0,
        sprint_speed: 28.5,
      },
      pitching: {
        xera: 2.85,
        xba_against: '.205',
        whiff_percent: 32.0,
        chase_whiff_percent: 38.0,
        fastball_avg_speed: 96.5,
        fastball_avg_spin: 2400,
      },
      bat_tracking: null,
      batted_ball: null,
    },
  };
}
