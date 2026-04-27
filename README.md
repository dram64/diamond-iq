# Diamond IQ

Cloud-native baseball analytics platform. The backend ingests live MLB
game data into DynamoDB on a 1-minute schedule and serves it via an
HTTP API. The frontend (separate folder) is a React + TypeScript SPA
that consumes the API to render scoreboards, live game tracking, and
stat leaderboards.

Built end-to-end on AWS serverless primitives — no servers to manage,
pay-per-use pricing comfortably inside the Lambda + DynamoDB free
tiers, and Terraform-defined infrastructure that any reviewer can
inspect, plan, and apply themselves.

## Live demo

The API is fronted by a CloudFront distribution with a WAFv2 Web ACL
attached (managed rule groups, rate limiting, bad-bot blocking, geo
awareness — see the [Security](#security) section). The CloudFront URL
is the public entry point for all real user traffic:

```bash
curl https://d17hrttnkrygh8.cloudfront.net/scoreboard/today
```

The direct API Gateway URL is preserved as a documented ops-only
debugging bypass (no WAF in front):

```bash
# bypass — direct to API Gateway, not through WAF
curl https://7x9tjaks0d.execute-api.us-east-1.amazonaws.com/scoreboard/today
```

Sample response (truncated):

```json
{
  "date": "2026-04-25",
  "count": 3,
  "games": [
    {
      "game_pk": 822909,
      "status": "live",
      "detailed_state": "In Progress",
      "away": { "id": 133, "name": "Athletics", "abbreviation": "ATH" },
      "home": { "id": 140, "name": "Texas Rangers", "abbreviation": "TEX" },
      "away_score": 3,
      "home_score": 0,
      "venue": "Globe Life Field",
      "linescore": { "inning": 3, "inning_half": "Bottom", "outs": 2 }
    }
  ]
}
```

## Architecture

Three top-level data paths reach the browser: a polling-driven HTTP
read path, a daily AI-content path, and a real-time push path. The
HTTP read path is fronted by CloudFront with WAFv2 attached (managed
+ custom rules, rate limiting, geo awareness — [ADR 010](docs/adr/010-waf-and-rate-limiting.md)).

```
                EventBridge rate(1 minute)
                          ▼
                  ┌───────────────┐
   MLB Stats API ◀│ Ingest Lambda │
                  └───────┬───────┘
                          │ put_item
                          ▼
                  ┌─────────────────┐ ────▶ DynamoDB Streams
                  │ DynamoDB games  │       (NEW_AND_OLD_IMAGES)
                  │ PK=GAME#<date>  │             │
                  │ CONTENT#<date>  │             ▼
                  └────┬────────────┘     ┌──────────────────┐
                       │                  │ stream-processor │ ◀── connections
                       │                  │      Lambda      │     by-game GSI
                       │                  └────────┬─────────┘
                       ▼                           │ PostToConnection
                ┌──────────────┐                   ▼
                │  API Lambda  │           ┌──────────────────┐
                └──────┬───────┘           │ API Gateway      │
                       │                   │ WebSocket API    │
                       ▼                   │ ($connect, etc.) │
                ┌──────────────┐           └──────────────────┘
                │ API Gateway  │                   ▲
                │  (HTTP API)  │                   │ wss://
                └──────┬───────┘                   │
                       │ origin                    │
                       ▼                           │
                ┌──────────────┐                   │
                │    WAFv2     │                   │
                │  (8 rules)   │                   │
                └──────┬───────┘                   │
                       │                           │
                       ▼                           │
                ┌──────────────┐                   │
   browser ────▶│  CloudFront  │                   │
                └──────────────┘                   │
                                                   │
                            EventBridge crons      │
                            (15/16/17 UTC)         │
                                  │                │
                                  ▼                │
                          ┌──────────────┐         │
   Bedrock (Claude) ◀────▶│   Daily      │         │
                          │   Content    │         │
                          │   Lambda     │         │
                          └──────────────┘         │
                                                   │
   browser (real-time)  ────────────────────────────
```

Three pipelines:

- **Polling read path** (browser → CloudFront → WAFv2 → API Gateway HTTP API → API Lambda → DynamoDB) backs scoreboard rendering with TanStack Query at 30-60 s intervals.
- **Daily AI content** writes recap/preview/featured items to the same DynamoDB table under a `CONTENT#<date>` partition. Generated by Claude Sonnet 4.6 via Bedrock on three EventBridge cron triggers, alarmed end-to-end via SNS. See [ADR 009](docs/adr/009-daily-content-generation.md).
- **Real-time push path** (DynamoDB Streams → stream-processor Lambda → connections-table by-game GSI → PostToConnection → WebSocket → browser) propagates score changes in ~0.7-0.9 s. The push augments polling rather than replacing it; if the WebSocket disconnects, the polling backstop keeps the UI fresh until the reconnect handshake completes. See [ADR 011](docs/adr/011-realtime-streaming-pipeline.md).

See [docs/architecture.md](docs/architecture.md) for component-by-component
detail and design rationale.

## Security

A WAFv2 Web ACL fronts the API at the CloudFront edge. Eight rules
total — four AWS-managed groups for OWASP-style coverage, four
custom rules for project-specific defenses. Managed groups ship in
COUNT mode for the observation week; custom rules (bad-User-Agent
blocking, per-IP rate limits) enforce from day one. Geo blocking
runs in COUNT mode by default for visibility without exclusion.

| Layer | What it does |
| --- | --- |
| CloudFront | Edge entry point; WAF attaches here. `CachingDisabled` policy keeps API responses fresh; `AllViewerExceptHostHeader` forwards Origin/auth headers to API Gateway |
| WAF custom rules | Block known scanner User-Agents (sqlmap, nikto, nmap, etc.), rate-limit `/content/today` and `/scoreboard/today` to 300/5min/IP, rate-limit everything else to 2000/5min/IP, optional geo block (CN, RU, KP, IR) |
| WAF managed groups | AWS-curated coverage: IP reputation list, OWASP common rule set, known bad inputs, bot control |
| Logging | All WAF decisions stream to CloudWatch Logs at `aws-waf-logs-diamond-iq` (14-day retention). CloudWatch Insights queries documented in the runbook |
| Alarms | `BlockedRequests > 1000/hr` (attack spike) and `AllowedRequests` anomaly-detection band (over-blocking detector). Both wire to the existing SNS alerts topic |
| Dev allow-list | Optional `var.dev_allow_list_cidrs` (gitignored, supplied via `terraform.tfvars`) bypasses all rules for listed IPs. Empty in production |

Full design rationale and rollout strategy in
[ADR 010](docs/adr/010-waf-and-rate-limiting.md). Operational
procedures (alarm triage, CloudWatch Insights queries, COUNT→BLOCK
flip plan) in [docs/runbook.md](docs/runbook.md).

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, React Router, TanStack Query, Tailwind CSS, Vitest |
| Backend runtime | Python 3.12, AWS Lambda, stdlib `urllib.request`, `dataclasses` |
| Data | DynamoDB (single-table design, PAY_PER_REQUEST, TTL, point-in-time recovery) |
| API | API Gateway HTTP API, AWS_PROXY integration, payload v2 |
| Scheduling | EventBridge `rate(1 minute)` |
| Infrastructure | Terraform 1.7+, S3 remote state with DynamoDB lock |
| Edge & security | CloudFront distribution, AWS WAFv2 (managed + custom rules), CloudWatch metric alarms via SNS |
| Real-time | DynamoDB Streams, API Gateway WebSocket API, stream-processor Lambda, browser-side WebSocket client with reconnect-with-backoff |
| AI content | Amazon Bedrock (Claude Sonnet 4.6 via cross-region inference profile), three EventBridge cron triggers, custom CloudWatch metrics |
| CI/CD | GitHub Actions, OIDC-assumed IAM role (zero long-lived AWS credentials) |
| Observability | CloudWatch Logs (structured JSON), 14-day retention; SNS-confirmed email alarms |

Data source: [MLB Stats API](https://statsapi.mlb.com/).

## Project structure

```
diamond-iq/
├── frontend/               React + TypeScript app (Vite)
├── functions/              AWS Lambda handlers (Python 3.12)
│   ├── shared/             MLB client, models, DynamoDB helpers, JSON logger
│   ├── ingest_live_games/  EventBridge-triggered ingestion Lambda
│   └── api_scoreboard/     API Gateway-triggered HTTP API Lambda
├── infrastructure/         Terraform stacks
│   ├── bootstrap/          One-time stack: S3 state bucket + DynamoDB lock
│   └── modules/            dynamodb, lambda, api-gateway, events, oidc
├── tests/                  pytest (53 tests; shared, ingest, api)
│   └── fixtures/           Captured MLB API responses
├── scripts/                Local invocation + bootstrap helpers
├── docs/                   Architecture, setup, runbook, ADRs
└── .github/workflows/      CI (lint/test/validate) + deploy (OIDC + apply)
```

## Getting started

Prerequisites: Python 3.12, [uv](https://docs.astral.sh/uv/), Terraform 1.7+,
Git, an AWS account. Full walkthrough in [docs/setup.md](docs/setup.md).

```bash
git clone https://github.com/dram64/diamond-iq.git
cd diamond-iq

# Backend
uv sync
uv run pytest

# Frontend
cd frontend
npm install
npm run dev    # http://localhost:5173
```

To invoke the backend Lambdas locally against the real MLB API (without
deploying):

```bash
uv run python scripts/invoke_ingest_locally.py --dry-run
uv run python scripts/invoke_api_locally.py --route scoreboard --seed live
```

## Operational tooling

Helper scripts under [scripts/](scripts/) wrap common operational
tasks against the deployed stack:

- `scripts/invoke_ingest_locally.py` — run the ingest handler
  in-process against a moto-mocked DynamoDB or a real table.
- `scripts/invoke_api_locally.py` — exercise an API route locally
  with seeded fixture data.
- `scripts/invoke_generate_locally.py` — call the deployed
  `diamond-iq-generate-daily-content` Lambda; supports `--date
  YYYY-MM-DD` for backfilling specific days.

Operational procedures (alarm triage, manual reruns, content
verification) live in [docs/runbook.md](docs/runbook.md).

## Deployment

The main stack auto-deploys on push to `main` via GitHub Actions:

1. `backend-ci.yml` runs ruff, black, pytest, and `terraform validate`
   on every PR and push.
2. `backend-deploy.yml` runs on push to `main`, assumes a least-privilege
   IAM role via OIDC, and runs `terraform plan -out=tfplan` →
   `terraform apply tfplan`. The plan is uploaded as a workflow artifact
   for audit.

Path filters route frontend-only changes away from backend CI/CD and
vice versa.

Manual deploy:

```bash
export AWS_PROFILE=diamond-iq
cd infrastructure
terraform init
terraform plan
terraform apply
```

First-time AWS setup (creates the state bucket + lock table) is in
[infrastructure/bootstrap/README.md](infrastructure/bootstrap/README.md).

## Documentation

- [docs/architecture.md](docs/architecture.md) — component diagram, design decisions, cost
- [docs/setup.md](docs/setup.md) — first-time setup walkthrough
- [docs/runbook.md](docs/runbook.md) — operational procedures (Lambda alarms, content generation, WAF triage)
- [docs/adr/](docs/adr/) — Architecture Decision Records
- [CONTRIBUTING.md](CONTRIBUTING.md) — coding standards, PR process

## Cost summary (monthly, at portfolio traffic volume)

| Component | Cost |
| --- | --- |
| Lambda invocations + duration (7 functions: ingest, api, content, 3 ws, stream-processor) | ~$1.00 |
| DynamoDB PAY_PER_REQUEST (games + connections tables) | ~$0.60 |
| DynamoDB Streams | included with games table |
| API Gateway HTTP API requests | <$0.50 |
| API Gateway WebSocket connection minutes + messages | ~$1.00 |
| CloudWatch Logs storage + ingestion | ~$1.00 |
| Bedrock (Claude Sonnet 4.6, ~350 K input / 200 K output tokens) | ~$4.00 |
| **Edge & security:** CloudFront + WAF Web ACL + 8 rules + WAF logs | **~$14.00** |
| SNS + EventBridge | <$0.10 |
| **Estimated monthly total** | **~$22-24** |

Comfortably inside Lambda + DynamoDB free tiers; the bulk of
spend is the security layer (WAF + CloudFront, ~$14), with the
AI content (~$4) and real-time pipeline (~$2) as the next-largest
line items.

## What this demonstrates

- **Cloud-native serverless architecture** end to end on AWS:
  Lambda, DynamoDB, API Gateway (HTTP + WebSocket), EventBridge,
  CloudFront, WAF, Bedrock, SNS, CloudWatch — all wired through
  Terraform with OIDC-assumed deploy roles.
- **Security engineering layer** with WAF managed rule groups,
  custom rate-limit + bad-bot rules, geo awareness, CloudWatch
  Logs Insights queries for investigation, and SNS-confirmed
  email alarms.
- **AI integration** using Bedrock's cross-region Anthropic
  inference profile, with idempotent generation, per-item
  failure isolation, and custom CloudWatch metrics for
  Bedrock-failure / DynamoDB-failure alarms.
- **Event-driven real-time architecture** — DynamoDB Streams →
  Lambda → WebSocket fan-out, with sub-second push latency and
  resilient polling backstop. Stream processor diffs old vs new
  images and only pushes meaningful changes.
- **Operational discipline** — every Lambda has structured JSON
  logs, every public endpoint has at least one alarm, every
  alarm routes to a confirmed SNS subscription, every architectural
  decision has an ADR.

## License

[MIT](LICENSE).
