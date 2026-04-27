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
