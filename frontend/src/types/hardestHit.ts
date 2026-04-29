/**
 * Response shapes for /api/hardest-hit/{date}.
 *
 * Mirrors the Phase 5L backend contract. Numeric fields the API returns as
 * Decimal (launch_speed, launch_angle, total_distance) round-trip through
 * JSON as plain numbers thanks to the api_responses._decimal_default
 * serializer (Phase 5E). Frontend type contract here is "number | null"
 * for those fields, since launch_angle and total_distance are nullable
 * upstream when the MLB tracker dropped a frame.
 *
 * 503 path: when the HITS#<date> partition is empty (cron hasn't fired
 * yet for that date, or future dates), the API returns 503 with
 * `error.code = "data_not_yet_available"`. The frontend treats that as
 * a clean empty state, not a failure — see useHardestHit and
 * HardestHitChart.
 */

export interface HardestHitRecord {
  game_pk: number;
  batter_id: number;
  batter_name: string;
  inning?: number | null;
  half_inning?: 'top' | 'bottom' | string | null;
  result_event?: string | null;
  result_event_type?: string | null;
  launch_speed: number;
  launch_angle?: number | null;
  total_distance?: number | null;
  trajectory?: string | null;
  ttl?: number;
}

export interface HardestHitData {
  date: string;
  limit: number;
  hits: HardestHitRecord[];
}

export interface HardestHitMeta {
  season: number;
  timestamp: string;
  cache_max_age_seconds: number;
}

export interface HardestHitResponse {
  data: HardestHitData;
  meta: HardestHitMeta;
}
