# Diamond IQ

Baseball analytics web app with live MLB game data, stat leaderboards, and player comparisons.

## Structure

- `frontend/` — React 18 + TypeScript + Tailwind (Vite)
- `functions/` — Python 3.12 AWS Lambda handlers
- `infrastructure/` — Terraform for AWS resources
- `tests/` — pytest suites for the Python code
- `scripts/` — local dev and deploy helpers
- `docs/` — architecture notes and runbooks

## Stack

- **Frontend**: React 18, React Router, TanStack Query, Tailwind CSS, Vitest
- **Backend**: Python 3.12, AWS Lambda, DynamoDB, API Gateway HTTP API
- **Data source**: MLB Stats API (`statsapi.mlb.com`)
- **Infrastructure**: Terraform, GitHub Actions (OIDC), CloudWatch

## Getting started

```bash
# Python side
uv sync
uv run pytest

# Frontend side
cd frontend
npm install
npm run dev
```
