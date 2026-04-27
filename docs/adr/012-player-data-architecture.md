# ADR 012 — Player and pitch-event data architecture

## Status
Accepted (design only; implementation deferred to Option 5 Phase 5B+).

## Context
Four sections of the home page render mock data and carry "Demo data"
badges:

- `LeaderCard` — batting and pitching leaders, plus standings.
- `HardestHitChart` — top hardest-hit balls of the day.
- `CompareStrip` — two-player side-by-side comparison.
- `TeamGridCard` — 8-team summary cards.

To remove those badges we need real player metadata, season stats,
team standings, and pitch-event data. The MLB Stats API exposes all
of it for free (no auth, no rate-limit ceremony beyond ~100 req/min/IP
common-courtesy). Six things had to be settled to commit to an
architecture before writing any code:

1. **Single-table or multi-table?** Existing project pattern is
   single-table on `diamond-iq-games`. Adding 5+ new tables would
   double the operational surface (Terraform, IAM, TTL, alarms).
2. **Schema shape — PK/SK per entity, GSI strategy.** Determines
   read efficiency for every dashboard component.
3. **Ingest cadence — daily batch vs event-triggered.** Batch is
   simpler; event-triggered scales better but adds plumbing.
4. **Computed metrics scope — trust the API or derive locally?**
   The portfolio bar is "we know what these mean," not "we beat
   Fangraphs."
5. **Pitch-level retention scope — every pitch, or only the
   hardest-hit subset?** Storage cost vs feature flexibility.
6. **Cross-season query support — committed to in v1, or deferred?**
   PK shape decision; cheap to bake in now, expensive to retrofit.

The full design lives in [docs/option5-design.md](../option5-design.md).
This ADR records the architectural commitments.

## Decision

### 1. Single-table extension of `diamond-iq-games`

All new entity types share the games table. Existing `GAME#<date>` and
`CONTENT#<date>` partitions are unaffected. The new partitions
(`PLAYER#GLOBAL`, `ROSTER#<season>#<teamId>`, `STATS#<season>#<group>`,
`STANDINGS#<season>`, `LEADERBOARD#<season>#<group>#<stat>`,
`HITS#<date>`) coexist on the same hash space without collisions
because the prefix discriminates by entity type.

This avoids ~5 new Terraform table resources, ~5 new IAM scopes,
and ~5 new TTL configs. It also means every Lambda that needs
reads across entity types (e.g., a player profile page that wants
metadata + current-season stats) can do them with a single
DynamoDB connection.

### 2. Pre-computed leaderboard snapshots, no GSI on stats

Two viable patterns for "top N players by stat":

- **Sparse GSI on the stats table** — query the GSI with
  `PK=STATS_LEADER#<season>#<group>#<stat>` and `Limit=N`.
  Real-time-ish but adds GSI write cost to every stats write.
- **Pre-computed leaderboard snapshots** — a daily Lambda reads
  the stats partition, sorts in-memory, writes top-50 rows to
  `LEADERBOARD#<season>#<group>#<stat>` with rank in the SK. Reads
  are pure Query with no filtering.

We picked **pre-compute** for v1. Rationale:

- Leaderboards are rendered once per dashboard page load by every
  user. A stale-by-up-to-24h leaderboard is acceptable for a
  portfolio analytics product. Live recomputation isn't a
  user-visible benefit.
- The daily compute Lambda is ~10 lines of pandas-free Python
  reading 230 rows and writing 500 — cheap.
- No GSI write multiplier on the hot ingest path.

If a future product need surfaces a real-time leaderboard
requirement, we'd add the GSI then.

### 3. Daily-batch ingest with three Lambdas

Three new Lambdas, each driven by EventBridge cron:

- **`ingest-players`** at 14:00 UTC — fetches teams + rosters +
  player metadata.
- **`ingest-stats`** at 14:30 UTC — fetches season stats for
  every qualified player; computes wOBA / OPS+ / FIP locally.
- **`compute-leaderboards`** at 15:00 UTC — sorts and snapshots
  the top-50 per stat.

Plus an extension to the existing ingest pipeline:

- A `extract-hits` Lambda triggered by DynamoDB Streams when a
  game's status transitions from `live` to `final`, walking
  `feed/live` for that game and writing hits with
  `launchSpeed > 95 mph` into `HITS#<date>`.

The batch cadence is intentionally aligned with the existing daily
content-generation Lambda (15-17 UTC window). Operationally it's
one wave per day, not a constant trickle.

### 4. Trust API direct stats; compute the wOBA/OPS+/FIP trio

The MLB Stats API directly provides every common stat
(`avg`, `obp`, `slg`, `ops`, `homeRuns`, `era`, `whip`, etc.). We
trust the upstream values. We compute three "advanced" metrics
ourselves: **wOBA** (linear-weighted on-base average),
**OPS+** (park-and-league-adjusted OPS), and **FIP**
(fielding-independent pitching).

The three were chosen because: (a) they are recognizable to
anyone looking at the project as a portfolio, (b) the formulas
are straightforward and require only primitives the API already
returns, and (c) computing them locally demonstrates we
understand the math, not just the API surface.

We deferred xwOBA, BABIP-against, ZiPS-style projections, and
park-adjusted SLG — all are interesting but require Statcast-grade
data or third-party model inputs we'd have to source elsewhere.

### 5. Hardest-hit-only pitch-event storage; deferred full retention

Storing every pitch event for every game is ~600k items/season.
Storing only events with `launchSpeed > 95.0 mph` (the threshold
MLB uses for "hard-hit") is ~50 events/day, ~9k/season. The
`HardestHitChart` only needs the latter.

Deferred: a `PITCHES#<season>#<pitcherId>` partition and the ingest
path to populate it. Documented as a Phase 5C+ option contingent on
real product need.

### 6. Season prefix in every PK; cross-season queries supported

Every entity that has a season scope (rosters, stats, standings,
leaderboards) embeds `<season>` in its PK. The cost is one extra
partition-key segment; the benefit is "compare 2026 to 2024" reads
become a `Query PK=STATS#2024#hitting`-style call instead of a
new schema migration.

The alternative (assume current season everywhere, retrofit when
asked for historical) would have made historical queries
require either a backfill sweep or a second table. Both are
worse than baking the season in now.

## Consequences

### Positive
- **One table, one IAM scope, one TTL config.** Operational
  surface stays where it is.
- **Single-Query reads for every dashboard component.** No fan-out,
  no client-side joins, no filtered scans.
- **Seasonal data is naturally partitioned.** Off-season cleanup
  is a date-prefix delete; cross-season comparison is a season
  swap.
- **Computed-stat trio is auditable.** Every wOBA/OPS+/FIP value
  in the table can be derived from primitives also stored in the
  table; reviewers can verify by hand.
- **No GSI on the high-write stats partition.** Write cost stays
  flat as the active player count grows.
- **Hardest-hit pitch storage is small and self-cleans via TTL.**
  No off-platform analytics tooling needed.

### Negative
- **Leaderboards stale by up to 24 hours.** Real-time leaderboard
  recomputation requires a future-phase GSI add.
- **Three new Lambdas plus one stream-triggered extension.** Each
  with its own log group, IAM policy, error alarm. ~10 minutes of
  Terraform per Lambda, well-trodden.
- **MLB API rate limit becomes a soft constraint at 10× scale.**
  Documented in the design doc; mitigation is splitting fetches
  across a wider window or using the `?personIds=1,2,...` bulk
  endpoint where supported.
- **No source-of-truth for league constants** (`lgOBP`, `cFIP`).
  Either compute by aggregating qualified-player totals daily, or
  hardcode an approximation per season. Implementation Phase 5B
  picks one.
- **`war` field inconsistency** in the MLB API response. The
  computed-stats trio doesn't depend on it, but `LeaderCard`
  currently renders WAR — Phase 5B verifies coverage before
  shipping.

### Operational notes
- Adding new partition prefixes to the existing single table does
  not require a Terraform migration — DynamoDB doesn't enforce
  schema. The Lambda IAM scope (`dynamodb:PutItem` on the table
  ARN) covers all new entity writes without policy changes.
- The `extract-hits` Lambda follows the streaming-pipeline pattern
  established in Option 4 (DynamoDB Streams trigger,
  `bisect_batch_on_function_error`, parallelization_factor=10).
  Same-shape implementation; only the diff function and the write
  target differ.
- Pre-existing `diamond-iq-stream-processor` Lambda is unchanged
  — `extract-hits` is a separate consumer of the same stream so
  the WebSocket fan-out and the hit extraction can fail
  independently.

## Alternatives considered

### Schema

- **Multi-table — one table per entity type.** Cleaner mental
  model but ~5× operational surface. Rejected for portfolio
  ergonomics.
- **Single-table with a single shared partition key shape and
  no entity prefix.** SK collisions become possible
  (a `STATS#<personId>` and a `ROSTER#<personId>` would both want
  to live under the same player). Rejected.

### Leaderboard read pattern

- **Sparse GSI for real-time top-N.** Adds write cost on every
  stats refresh × every leadable stat. Rejected for v1.
- **Compute on read in the API Lambda.** Simple but every page
  load triggers a Query of all qualified players' stats (~150
  rows × 5 KB ≈ 1 MB) and sorts in-memory before returning.
  Cold start latency unacceptable. Rejected.

### Ingest cadence

- **Per-game-final triggered.** Better-than-daily freshness but
  the leaderboard depends on the full league's stats, so a
  per-game trigger would re-run the leaderboard compute 15
  times/day. Marginal benefit; rejected.
- **Continuous polling at 1-minute intervals like the games
  ingest.** 1500 active players × 60 polls/hour = unsustainable
  and against MLB's effective rate limit. Rejected.

### Computed-metric scope

- **No locally-computed stats; just render the API direct
  values.** Loses the "we understand sabermetrics" portfolio
  signal. Rejected.
- **Full Fangraphs-grade derived stat suite (xwOBA, ZiPS, etc.).**
  Multiple-week project on its own; out of scope for v1.

### Pitch-level retention

- **Every pitch every game.** ~600k items/season. Storage cost
  is fine; query patterns are unclear without a feature need.
  Rejected — premature.
- **No pitch-level data at all.** Can't satisfy `HardestHitChart`.
  Rejected.
- **Hard-hit only (>95 mph).** Compromise; matches the only known
  consumer.

### Season prefix

- **Implicit current-season; no prefix.** Saves ~6 chars per PK,
  costs a future migration when historical queries land. Rejected.
- **Calendar year prefix at every level (PK + SK).** Bloats SKs
  for marginal benefit; PK-only is the cleaner location.

## Forward references

- Implementation begins in **Phase 5B** against the schema and
  ingest plan in [docs/option5-design.md](../option5-design.md).
- Open questions list in section (g) of the design doc must be
  resolved or formally deferred before Phase 5B PRs land.
- This ADR is the contract; subsequent commits in Option 5 should
  link back here when they instantiate one of the entity types
  or computed metrics.

## Amendment — Phase 5B implementation decisions

Phase 5B ships the `ingest-players` Lambda. Five decisions deviated
from or refined the original ADR; recording them here so the ADR
matches what's deployed.

### 1. WAR dropped from the schema entirely

The "Negative" bullet above flagged WAR coverage as a Phase 5B
verification item. **Outcome:** verified live against `personId=592450`
(Aaron Judge) in 2026 — the MLB Stats API does not expose `war` on
`/people/{id}` nor in the `stats(group=hitting,type=season)` hydrate.
The field is `null` at the top level and absent from `splits[].stat`.

We removed WAR from the player metadata projection rather than ship
a permanently-null field. The 8 stored metadata attributes are:
`person_id`, `full_name`, `primary_number` (when present),
`current_age`, `height`, `weight`, `bat_side`, `pitch_hand`,
`primary_position_abbr`. `LeaderCard`'s WAR row will need to source
from a different upstream (Fangraphs scrape, manual data entry, or
the Phase 5C+ derived-metrics pipeline) — out of Phase 5B scope.

### 2. Two cron schedules, single Lambda, mode parameter

ADR 012 specified `ingest-players at 14:00 UTC` as a single rule.
Phase 5B splits the work across two EventBridge schedules driving
the same function:

- `rate(7 days)` with `{"mode": "full"}` — refreshes player
  metadata (changes rarely; weekly is enough).
- `cron(0 12 * * ? *)` with `{"mode": "roster_only"}` — refreshes
  roster assignments (trades, call-ups; needs daily freshness).

The handler validates mode against `frozenset({"full", "roster_only"})`,
defaults to `"full"`, and branches on the bulk-people-fetch step.
Single Lambda over two because the deployment surface (IAM,
alarm wiring, log group) is shared and the branching is ~10 lines.

### 3. 50-ID batching with silent-drop log

The `/people?personIds=` bulk endpoint silently drops unknown IDs
(verified live: 1 bogus + 2 real returned HTTP 200 with 2 people).
Phase 5B chunks person IDs at `PEOPLE_BULK_BATCH_SIZE = 50`,
computes a requested-vs-returned diff per batch, and logs at INFO
when IDs are dropped. **Silent drops do not increment
`PlayersFailedCount`** — they're an upstream-data condition, not a
handler failure. A whole-batch fetch failure (HTTP 5xx after retry
exhaustion) does count toward `PlayersFailedCount` and is isolated
per-batch so other batches still run.

### 4. Daily-only invocations-zero alarm; weekly skipped

CloudWatch metric-alarm `period` caps at 86400 seconds (24 hours).
Setting an `Invocations <= 0 over 7 days` alarm requires a custom
metric-math expression and adds operational complexity for a
weekly schedule that is also covered indirectly by the
`Errors > 0` alarm (a missed cron emits no errors but also no
invocations — a 7-day silence would surface the next week
regardless). The runbook should call out manual weekly verification
during ops rotation; the alarm is intentionally absent.

### 5. Custom metrics under `DiamondIQ/Players`

Four metrics emitted via `cloudwatch:PutMetricData` scoped by
namespace condition: `PlayersIngestedCount`, `RostersIngestedCount`,
`TeamsFailedCount`, `PlayersFailedCount`. Emission is wrapped in
try/except — a metrics-API outage doesn't fail the Lambda. The
namespace is the IAM scope boundary (`cloudwatch:namespace`
condition key on the Statement), keeping the function unable to
write to other projects' namespaces.
