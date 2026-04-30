/**
 * Response shapes for /api/players/compare.
 *
 * Mirrors the Phase 5E backend contract. Each player has metadata
 * always present (the API 404s if any requested id has no
 * PLAYER#GLOBAL row), plus optional hitting / pitching season-stats
 * blocks that may be null if the player isn't in the qualified pool
 * for that group this season.
 */

export interface ComparePlayerMetadata {
  person_id: number;
  full_name: string;
  primary_number?: string;
  current_age?: number;
  height?: string;
  weight?: number;
  bat_side?: string;
  pitch_hand?: string;
  primary_position_abbr?: string;
}

export interface ComparePlayerStats {
  /** Catch-all — every numeric or string stat the API returns lives here. */
  [key: string]: unknown;
}

export interface ComparePlayer {
  person_id: number;
  metadata: ComparePlayerMetadata;
  hitting: ComparePlayerStats | null;
  pitching: ComparePlayerStats | null;
  /** Optional career-awards summary (Phase 6). Null/undefined if the awards
   *  ingest cron hasn't yet populated AWARDS#GLOBAL for this player. */
  awards?: PlayerAwardsBlock | null;
}

export interface PlayerAwardsBlock {
  person_id: number;
  total_awards: number;
  all_star_count: number;
  all_star_years: number[];
  mvp_count: number;
  mvp_years: number[];
  cy_young_count: number;
  cy_young_years: number[];
  rookie_of_the_year_count: number;
  rookie_of_the_year_years: number[];
  gold_glove_count: number;
  gold_glove_years: number[];
  silver_slugger_count: number;
  silver_slugger_years: number[];
  world_series_count: number;
  world_series_years: number[];
}

export interface CompareData {
  players: ComparePlayer[];
}

export interface CompareMeta {
  season: number;
  timestamp: string;
  cache_max_age_seconds: number;
}

export interface CompareResponse {
  data: CompareData;
  meta: CompareMeta;
}
