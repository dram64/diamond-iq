# ADR 015 — Phase 6 feature expansion

## Status

Accepted (implemented April 2026). This is a separate ADR rather than an
amendment to ADR 012 because Phase 6 is a feature-surface expansion of the
dashboard product (homepage, compare, teams, stats) rather than an
evolution of the player-data partition strategy. ADR 012 stays scoped to
"how player data lives in the table"; this one is "what the dashboard
does with it."

## Context

After commit `41fe4fe` declared Diamond IQ feature-complete (Option 5
Phase 5L), eight follow-on requests reopened scope:

1. **Featured Matchup of the Day** on the home page — daily-rotating
   two-player spotlight with a click-through to a deep compare view.
2. **Yesterday's Game Recap rewrite** — analytical / numbers-driven
   instead of narrative prose.
3. **Player comparisons inside the recap** — embedded head-to-head
   sub-blocks instead of long-form text.
4. **Search bar fix** — the navbar had a placeholder `<input>` with no
   handler; needed real typeahead over the player table.
5. **Compare page extension** — N-player support (2-4) with career
   accolades and an AI-written analytical paragraph.
6. **Live tab removal** — drop the dedicated `/live/:gameId` page.
7. **Teams page** — fill in the empty `/teams` route and a per-team
   detail page.
8. **Stats Explorer** — fill in the empty `/stats` route as a
   leaderboards browser.

Constraint: existing infrastructure patterns must hold. New features
must follow the established Lambda-+-cron-+-alarms-+-IAM-+-tests-+-ADR
shape; no new charting libraries, no auth surface, no write paths.
Realistic cost delta target: **+$1-3 / month at portfolio traffic**.

## Decisions

### 1. Two new Lambdas, not three

The plan started with three new Lambdas (awards, search, AI compare).
We collapsed search into the existing `api_players` Lambda — it shares
the same DynamoDB read pattern and partition (PLAYER#GLOBAL), and the
single-Lambda routeKey-dispatch pattern from Phase 5E already handles
multi-route fan-out cleanly. Net result: **2 new Lambdas** (`ingest-
player-awards`, `ai-compare`) plus 5 new API routes on the existing
`api_players` Lambda's two-route-list pattern.

### 2. Awards: hardcoded MLB-tier allowlist

MLB's `/people/{id}/awards` endpoint returns a mix of MLB-tier honors
(MVP, Cy Young, All-Star, Gold Glove, etc.) and lower-tier entries (SAL
Mid-Season All-Star, college conference awards, international leagues).
Filtering to MLB-tier is essential — otherwise Aaron Judge's career
hardware list reads with 80+ entries instead of the meaningful 16.

We hardcode an allowlist of stable upstream id codes:

  - **MVP** — `ALMVP`, `NLMVP`, `MLBMVP`
  - **Cy Young** — `ALCY`, `NLCY`, `MLBCY`
  - **Rookie of the Year** — `ALROY`, `NLROY`
  - **All-Star** — `MLBASG`, `ALAS`, `NLAS`
  - **Gold Glove** — `ALGG`, `NLGG`, `MLBGG`
  - **Silver Slugger** — `ALSS`, `NLSS`, `MLBSS`
  - **World Series ring** — `WSC`

Plus secondary categories (`ASGMVP`, `WSMVP`, `ALCSMVP`, `NLCSMVP`)
recognized but rolled into the `total_awards` count without surface
display. The seven-bucket aggregate is what the Compare card shows.

**Tradeoff:** if MLB ever renames an id code (rare but not impossible),
that category drops to 0 silently until we patch. We accept this; the
alternative — a fuzzy-match heuristic over award `name` strings — has
worse failure modes.

### 3. Featured matchup: deterministic seeded RNG over wOBA top-10

The home-page Featured Matchup must be **stable across reloads** within
a UTC day so a refresh doesn't shuffle the spotlight, and **rotate**
day-over-day so it doesn't get stale. We hash `(date_iso, season)` →
SHA-256 → take the leading 32 bits as a seed, then index into a top-10
wOBA list pulled from `STATS#<season>#hitting`.

**Why STATS not LEADERBOARD:** there's no pre-computed `LEADERBOARD#`
partition in this build (Phase 5D's leaders route reads STATS directly
and sorts on the fly; same shape works here). Top-10 from ~150-200
qualified hitters costs one Query + in-memory sort, well under 100 ms
p99 — no infrastructure addition warranted.

**Cross-team preference:** if the seeded indices land on two players on
the same team, we walk forward through the seed-derived offset table
up to 3 times looking for a different-team second pick. After 3
retries (extreme edge case) we accept the same-team pair anyway. A
stale or off-season partition (< 2 qualified hitters) returns 503
`data_not_yet_available` with the empty-state UI rendering the count.

### 4. Search: in-memory scan over the 779-row PLAYER#GLOBAL partition

The player table has ~779 rows. Substring + prefix matching in memory
is well under 100 ms p99 at this scale. We do **not** introduce
OpenSearch, an ElasticCache layer, or a name-prefix GSI — those add
operational surface (clusters, IAM, alarms, cost) for a corpus that
fits in 60 KB of JSON.

If the table grows beyond ~5,000 rows we'd revisit. Documented in the
search route module docstring so the next maintainer knows the
tipping point.

### 5. Recap rewrite: structured JSON inside `<json>` tags

The new recap prompt requires Claude to emit:

```json
{
  "headline": "lead with the most distinguishing fact",
  "score_summary": "one-sentence final state",
  "top_performers": [{"name", "team", "line", "context?"}],
  "head_to_head": [{"player_a": {...}, "player_b": {...}, "takeaway"}],
  "tidbits": ["short stat-grounded observations"]
}
```

Wrapped in `<json>...</json>` sentinel tags so a regex extraction is
deterministic even if the model leaks an explanation around the JSON
block. The frontend `parseAnalyticalRecap()` falls back to the legacy
narrative paragraph render if the JSON parse fails — pre-Phase-6
content rows in DynamoDB still display correctly during the
transition window.

**Stat-light scope:** Phase 6 ships the structural rewrite without
pulling DAILYSTATS data into the prompt. The model produces
structurally-correct but stat-thin recaps until Phase 6.1 (or never;
the structural change alone is the meaningful product improvement).

### 6. AI Compare: cache-first, model-swappable, route-shared Lambda

`/api/compare-analysis/players` and `/api/compare-analysis/teams`
share one Lambda with route-dispatch. Each request:

  1. Checks the **AIANALYSIS#<kind>#<season>#<sorted-ids>** cache row.
     If present and TTL not expired, returns it (`cache_hit: true`).
  2. Gathers source data — players: PLAYER#GLOBAL + STATS#<season> +
     AWARDS#GLOBAL; teams: TEAMSTATS#<season>.
  3. Builds a stable JSON-shaped prompt body, invokes Bedrock.
  4. Writes the result with a 7-day TTL.

**Model-swappable:** `BEDROCK_MODEL_ID` env var. Phase 6 ships with
**Claude Haiku 3.5** because the test AWS account hit a daily-token
throttle on Haiku 4.5 during the smoke-test gate (the daily-token
quota is non-adjustable; resets at UTC midnight). Swapping to 4.5
later is one Terraform value change.

**Cache key includes season** so a 2027 rerun of the same player pair
regenerates rather than serving a stale 2026 analysis with a 2027
header.

**Failure modes:**
  - 502 `bedrock_unavailable` on `ThrottlingException` /
    `ServiceUnavailableException` / `InternalServerException`
  - 502 `bedrock_empty` if the model returns empty text
  - 404 `player_not_found` / `team_not_found` if any source row missing
  - Cache write failures don't block the response (we log + serve
    uncached; the next user pays the regeneration cost again)

### 7. Cost projection (Phase 6 delta)

| Item | Monthly |
|------|---------|
| `ingest-player-awards` (4 invocations × ~80 s × 512 MB) | ~$0.02 |
| Bedrock Haiku 3.5 calls (~150 unique compares/mo, 7-day cache) | ~$0.50-1.20 |
| `ai-compare` Lambda compute | <$0.10 |
| AIANALYSIS DDB storage + RCU/WCU | <$0.05 |
| 5 new API GW routes (low traffic) | <$0.10 |
| **Phase 6 delta total** | **~$1-1.50/mo** |

Within the user-stated +$1-3 ceiling. New monthly project total:
**~$26/mo**, dominated still by API WAF + CloudFront ($14).

### 8. Live tab removal

The `/live/:gameId` route powered a per-game live experience that
overlapped substantially with the home-page live scoreboard. Removing
it simplifies the navbar to four entries (Today, Compare, Teams, Stat
Explorer) and reclaims the WebSocket-subscription complexity if we
ever rebuild a similar view.

The home-page LiveGameCard tiles **stay** as a non-interactive
scoreboard surface — the data path is unchanged, only the
click-through is removed. WebSocket pipeline (DynamoDB Streams →
stream-processor → connections table) stays intact for future use.

## Consequences

### Positive

  - **Eight new feature surfaces** without introducing OpenSearch, a
    new charting library, or a write surface.
  - **Cache-first AI** — a recruiter clicking through the same
    compare 5 times pays one Bedrock call total.
  - **Model-swappable** Bedrock integration lets us upgrade Haiku 3.5
    → 4.5 (or fall back to 3) without touching code.
  - **Frontend pages all under 9 KB gzip** — lazy-chunked, no impact
    on home-page LCP.
  - **Search latency p99 < 100 ms** at the current 779-row corpus —
    no infrastructure surface added.

### Negative

  - **Daily-token throttle exposure** for Bedrock. The us-east-1
    account-wide daily-token cap is non-adjustable; if we exhaust it
    via traffic plus generate-daily-content, AI Compare returns 502s
    until UTC midnight. Frontend renders a graceful "Generating
    analysis…" → "Try again shortly" path.
  - **Awards staleness** — weekly cron means a fresh post-season
    award announcement could lag up to 7 days. Acceptable for a
    portfolio dashboard.
  - **Recap stat-thinness** in v6 — until DAILYSTATS hint enrichment
    lands, the analytical recap is structurally clean but uses fewer
    specific player-line numbers than the raw data could support.

### Smoke-test record

The Haiku 4.5 smoke test couldn't complete during Phase 6 build
because the AWS account hit the global cross-region daily-token cap
(`Adjustable: false`, resets nightly UTC). We swapped to Haiku 3.5
(separate quota bucket — same daily cap landed there too within the
same UTC day). Production deploy ships with Haiku 3.5 as the
default model; measurement deferred to a Phase 6.0.1 follow-up
re-run. The model-swappable env var means changing this is a one-
line Terraform edit.

## Future polish

  - **Phase 6.1 — DAILYSTATS recap enrichment.** Pull yesterday's
    boxscore stats into the recap prompt builder so the analytical
    cards have specific player lines to cite. Estimated +80 LOC,
    one extra DDB query per recap call.
  - **AIANALYSIS partition GSI.** If we ever want a "browse all AI
    analyses" surface (we don't, today), a GSI on (kind, season)
    avoids a full-table scan.
  - **Bedrock latency p95 SLO alarm.** Haiku is fast (1-3 s typical)
    but a long tail could surface as "Generating analysis…" hanging
    forever. Wire a CloudWatch alarm on `ai-compare` Duration p95 > 8 s
    once we have a baseline measurement.
  - **Search relevance ranking.** Today the typeahead is alphabetical
    after a prefix-vs-substring split. A more mature ranker would
    weight by recent activity (recent boxscore appearance, recent
    AS / MVP votes) — out of scope for Phase 6.
