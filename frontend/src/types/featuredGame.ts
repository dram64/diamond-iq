/**
 * Response shape for /api/games/featured (Phase 8.5 Track 1).
 *
 * Backed by today's MLB schedule (statsapi.mlb.com), date-seed picked
 * among non-final games and joined to the STANDINGS partition for
 * run_differential. Probable pitchers populated only for Preview /
 * Scheduled status; null on Live and Final.
 *
 * 503 paths the route surfaces:
 *   { code: "off_day"               }  — no MLB games today
 *   { code: "data_not_yet_available" } — upstream MLB API hiccup
 *
 * The frontend treats both 503 codes as the off-day banner path.
 */

export type FeaturedGameStatus = 'live' | 'final' | 'scheduled' | 'preview' | 'postponed';

export interface FeaturedGameProbablePitcher {
  id: number;
  full_name: string;
}

export interface FeaturedGameTeam {
  team_id: number;
  team_name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  run_differential: number | null;
  probable_pitcher: FeaturedGameProbablePitcher | null;
}

export interface FeaturedGameData {
  date: string;
  game_pk: number;
  status: FeaturedGameStatus;
  detailed_state: string;
  start_time_utc: string;
  venue: string | null;
  away: FeaturedGameTeam;
  home: FeaturedGameTeam;
  selection_reason: string;
}

export interface FeaturedGameResponse {
  data: FeaturedGameData;
  meta: {
    season: number;
    timestamp: string;
    cache_max_age_seconds: number;
  };
}
