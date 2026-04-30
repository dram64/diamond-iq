/**
 * Response shapes for /api/teams/{teamId}/stats and /api/teams/compare.
 *
 * Mirrors the Phase 5L backend contract (`functions/api_players/routes/
 * team_stats.py` and `team_compare.py`). Hitting and pitching blocks are
 * always present for an ingested team — the backend 503s if a team has no
 * row at all rather than returning partial data.
 */

export interface TeamStatsBlock {
  /** Catch-all — every numeric or string stat the API returns lives here. */
  [key: string]: unknown;
}

export interface TeamStats {
  team_id: number;
  team_name: string;
  season: number;
  hitting: TeamStatsBlock;
  pitching: TeamStatsBlock;
}

export interface TeamStatsMeta {
  season: number;
  timestamp: string;
  cache_max_age_seconds: number;
}

export interface TeamStatsResponse {
  data: TeamStats;
  meta: TeamStatsMeta;
}

export interface TeamCompareData {
  season: number;
  teams: TeamStats[];
}

export interface TeamCompareResponse {
  data: TeamCompareData;
  meta: TeamStatsMeta;
}
