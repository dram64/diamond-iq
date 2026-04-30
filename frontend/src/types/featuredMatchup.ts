/**
 * Response shape for /api/featured-matchup (Phase 6).
 *
 * Two-player deterministic daily-rotating pick. The selection logic (top-10
 * wOBA leaderboard, hash-seeded by date) lives backend-side; the frontend
 * just renders the player IDs + light metadata.
 */

export interface FeaturedMatchupPlayer {
  person_id: number;
  full_name: string | null;
  team_id: number | null;
  primary_position_abbr: string | null;
  woba: string | number | null;
}

export interface FeaturedMatchupData {
  date: string;
  player_ids: [number, number];
  players: [FeaturedMatchupPlayer, FeaturedMatchupPlayer];
  selection_reason: string;
}

export interface FeaturedMatchupResponse {
  data: FeaturedMatchupData;
  meta: {
    season: number;
    timestamp: string;
    cache_max_age_seconds: number;
  };
}
