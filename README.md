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

The API is currently serving real MLB Stats API data:

```bash
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

```
                                     EventBridge (rate(1 minute))
                                              |
                                              v
                                    ┌──────────────────┐
                MLB Stats API <───  │  Ingest Lambda   │
                                    │   (Python 3.12)  │
                                    └────────┬─────────┘
                                             │ put_item
                                             v
                                    ┌──────────────────┐
                                    │ DynamoDB (games) │
                                    │ PK=GAME#<date>   │
                                    │ SK=GAME#<gamePk> │
                                    └────────┬─────────┘
                                             ^ get_item / query
                                             │
                                    ┌────────┴─────────┐
                                    │   API Lambda     │
                                    │  (Python 3.12)   │
                                    └────────┬─────────┘
                                             ^
                                             │
                                    ┌────────┴─────────┐
   Browser / curl  ─────────────>   │  API Gateway     │
                                    │  (HTTP API)      │
                                    └──────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for component-by-component
detail and design rationale.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, React Router, TanStack Query, Tailwind CSS, Vitest |
| Backend runtime | Python 3.12, AWS Lambda, stdlib `urllib.request`, `dataclasses` |
| Data | DynamoDB (single-table design, PAY_PER_REQUEST, TTL, point-in-time recovery) |
| API | API Gateway HTTP API, AWS_PROXY integration, payload v2 |
| Scheduling | EventBridge `rate(1 minute)` |
| Infrastructure | Terraform 1.7+, S3 remote state with DynamoDB lock |
| CI/CD | GitHub Actions, OIDC-assumed IAM role (zero long-lived AWS credentials) |
| Observability | CloudWatch Logs (structured JSON), 14-day retention |

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
- [docs/runbook.md](docs/runbook.md) — operational procedures
- [docs/adr/](docs/adr/) — Architecture Decision Records
- [CONTRIBUTING.md](CONTRIBUTING.md) — coding standards, PR process

## License

[MIT](LICENSE).
