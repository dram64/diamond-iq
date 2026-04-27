# Runbook

Operational procedures for common scenarios. Each procedure includes
the exact commands to run and a verification step.

Assumes `AWS_PROFILE=diamond-iq` and `MSYS_NO_PATHCONV=1` exported.

---

## Design note: ingest re-writes every minute

The ingest Lambda re-writes all qualifying games (Live, Final, Preview)
to DynamoDB every minute it runs, without checking whether anything
changed since the previous tick. Cost at production scale is roughly
$0.05/day under PAY_PER_REQUEST, considered acceptable in exchange for
simpler idempotent semantics: every write is unconditional, status
transitions (Live → Final) overwrite in place by stable PK/SK, and the
TTL is re-stamped on every touch so Final games always live ~7 days
from their last update. A future optimization could conditional-write
only on state change; deliberately deferred.

---

## Redeploy a single Lambda manually

When the CI/CD path is broken or you want to push code changes without
a full Terraform run.

```bash
# 1. Build the deploy zip the same way Terraform does
cd functions/ingest_live_games   # or api_scoreboard
mkdir -p .build/shared
cp -R . .build/
cp -R ../shared/. .build/shared/
cd .build && zip -r ../package.zip . && cd ..

# 2. Push the new code
aws lambda update-function-code \
  --function-name diamond-iq-ingest-live-games \
  --zip-file fileb://package.zip

# 3. Verify the Last Modified timestamp changed
aws lambda get-function \
  --function-name diamond-iq-ingest-live-games \
  --query "Configuration.{Name:FunctionName,LastModified:LastModified,CodeSha256:CodeSha256}"
```

Note: this puts Terraform out of sync with reality. The next
`terraform apply` will detect the drift and roll the function back to
whatever's in the committed source. Use this only as a stop-gap.

---

## Read CloudWatch logs effectively

```bash
# Tail the last N minutes of a Lambda's logs
aws logs tail /aws/lambda/diamond-iq-ingest-live-games --since 10m

# Follow live (Ctrl-C to stop)
aws logs tail /aws/lambda/diamond-iq-ingest-live-games --follow

# Filter to error level only
aws logs tail /aws/lambda/diamond-iq-ingest-live-games --since 1h \
  --filter-pattern '{ $.level = "ERROR" }'

# JSON-shaped queries with CloudWatch Logs Insights:
# Open the AWS console → CloudWatch → Logs Insights → pick the log group, then:
#   fields @timestamp, level, message, games_written, games_failed
#   | filter level = "INFO" and message = "Ingest run complete"
#   | sort @timestamp desc
#   | limit 100
```

API Gateway access logs:

```bash
aws logs tail /aws/apigateway/diamond-iq-api --since 10m
```

---

## Manually trigger an ingest run

Two options.

**Option A — via the AWS CLI** (uses the deployed Lambda code):

```bash
aws lambda invoke \
  --function-name diamond-iq-ingest-live-games \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/ingest_response.json

cat /tmp/ingest_response.json
```

**Option B — locally** (uses your working tree's code; useful for
testing changes before deploying):

```bash
uv run python scripts/invoke_ingest_locally.py --table-name diamond-iq-games
```

Verify in DynamoDB:

```bash
aws dynamodb scan --table-name diamond-iq-games --select COUNT
```

---

## Roll back a bad deploy

Terraform state is versioned in S3, so any apply can be rolled back to
the prior state without touching git.

```bash
# 1. List state versions
aws s3api list-object-versions \
  --bucket diamond-iq-tfstate-334856751632 \
  --prefix main/terraform.tfstate \
  --query 'Versions[].{Id:VersionId,Modified:LastModified}' \
  --output table

# 2. Restore the previous version (use the version id from the list above)
aws s3api copy-object \
  --bucket diamond-iq-tfstate-334856751632 \
  --copy-source 'diamond-iq-tfstate-334856751632/main/terraform.tfstate?versionId=<previous-version-id>' \
  --key main/terraform.tfstate

# 3. Apply the now-restored state
cd infrastructure
terraform init -reconfigure
terraform plan       # should show the resources being moved BACK to the prior config
terraform apply

# 4. Revert the offending git commit so future deploys don't re-introduce the bad change
git revert <bad-commit-sha>
git push origin main
```

If the bad change destroyed data (e.g. dropped a DynamoDB item), check
the DynamoDB PITR window:

```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name diamond-iq-games \
  --target-table-name diamond-iq-games-restored \
  --restore-date-time "2026-04-25T00:00:00Z"
```

---

## Investigate "no live games" when games should be live

Most often a UTC vs local-date issue (see [ADR 004](adr/004-two-date-ingestion-window.md)). Diagnostic
sequence:

```bash
# 1. Are EventBridge invocations happening?
aws logs tail /aws/lambda/diamond-iq-ingest-live-games --since 5m

#    Expected: one START per minute, plus a JSON summary line.
#    If empty: check the rule
aws events describe-rule --name diamond-iq-ingest-schedule \
  --query "{State:State,Schedule:ScheduleExpression}"

# 2. What is MLB returning for both UTC dates the Lambda queries?
TODAY=$(date -u +%Y-%m-%d)
YESTERDAY=$(date -u -d 'yesterday' +%Y-%m-%d)
curl -s "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=$YESTERDAY" \
  | python -c "import json,sys; d=json.load(sys.stdin); print(YESTERDAY, sum(1 for date in d.get('dates',[]) for g in date.get('games',[]) if g['status']['abstractGameState']=='Live'), 'live')"
curl -s "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=$TODAY" \
  | python -c "import json,sys; d=json.load(sys.stdin); print(TODAY, sum(1 for date in d.get('dates',[]) for g in date.get('games',[]) if g['status']['abstractGameState']=='Live'), 'live')"

# 3. What is in DynamoDB right now?
aws dynamodb query --table-name diamond-iq-games \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"GAME#$TODAY\"}}" \
  --select COUNT
aws dynamodb query --table-name diamond-iq-games \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"GAME#$YESTERDAY\"}}" \
  --select COUNT
```

If MLB shows 0 live for both UTC dates, the system is healthy and
correctly self-throttling. Games visible to a user in their local
timezone may be in `Preview` (haven't started yet) or `Final` (already
ended) at MLB's API even though the user perceives them as "tonight's
games."

---

## Add a new MLB API endpoint to the ingestion

Roughly:

1. **`functions/shared/mlb_client.py`** — add a new `fetch_<thing>()`
   function calling the right URL pattern.
2. **`functions/shared/models.py`** — add a dataclass + `normalize_<thing>()`
   function for the new entity.
3. **`functions/shared/dynamodb.py`** — add `put_<thing>` / `get_<thing>` /
   `list_<thing>s` helpers if the access patterns differ from
   `(PK, SK)`.
4. **`functions/<lambda>/handler.py`** — call the new function in the
   appropriate handler.
5. **`tests/`** — pytest coverage for normalization + happy/sad paths
   on the handler.
6. **PR + CI** — push, watch CI green, deploy auto-fires on merge.

The single-table DynamoDB design means new entities live in the same
table with new PK prefixes — no schema migration. See [ADR 001](adr/001-single-table-dynamodb.md).

---

## Drain the DynamoDB table (test environments only)

There's no native `TRUNCATE`. Two options:

**Option A — destroy/re-create via Terraform** (loses TTL config; clean):

```bash
cd infrastructure
terraform destroy -target=module.dynamodb
terraform apply -target=module.dynamodb
```

**Option B — scan + batch delete** (preserves the table):

```bash
aws dynamodb scan --table-name diamond-iq-games \
  --projection-expression "PK,SK" --output json \
  | python -c '
import json,sys,subprocess
d = json.load(sys.stdin)
for item in d["Items"]:
    subprocess.run(["aws","dynamodb","delete-item","--table-name","diamond-iq-games",
                    "--key", json.dumps({"PK": item["PK"], "SK": item["SK"]})])
'
```

Verify:

```bash
aws dynamodb scan --table-name diamond-iq-games --select COUNT
```

---

## Cost monitoring

```bash
# Current month-to-date spend (via Cost Explorer API)
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[].Total.UnblendedCost'
```

Or in the AWS console: **Billing → Cost Explorer → Daily costs**.

Expected baseline (no traffic):
- DynamoDB: $0 (under PAY_PER_REQUEST free tier)
- Lambda: $0 (under 1M invocations + 400k GB-sec free tier)
- API Gateway HTTP API: < $0.01 (no free tier; $1 per million requests)
- CloudWatch Logs: $0 (under 5 GB free tier)
- S3 (state bucket): $0 (under 5 GB free tier)

If MTD spend exceeds **$2** without a traffic explanation, investigate.
The CloudWatch billing alarm at $10 will fire before things get
seriously out of hand.

Common cost surprises:
- CloudWatch log retention set to "Never expire" — should always be
  finite. Our Terraform sets 14 days on every group.
- A misbehaving Lambda in a tight loop. Check
  `aws lambda list-functions ... --query 'Functions[].LastModified'`
  for unexpected recent updates.
- DynamoDB on-demand spike from a runaway client. The CloudWatch
  metric `ConsumedWriteCapacityUnits` will show it.

---

## Daily Content Generation Lambda

The `diamond-iq-generate-daily-content` Lambda produces yesterday's
recaps, today's previews, and two featured matchups by calling Claude
Sonnet 4.6 on Bedrock. Design rationale lives in
[ADR 009](adr/009-daily-content-generation.md).

### What it does

EventBridge fires the Lambda three times daily at 15:00, 16:00, and
17:00 UTC. The 15:00 tick is primary; the 16:00 and 17:00 ticks are
opportunistic fillers — an idempotency check makes them no-ops on a
healthy run, but they recover whatever the first tick missed if a
transient error blocked some of the items.

A successful run takes ~30-90s end-to-end on a normal slate
(15-20 games × ~3-5s per Bedrock call). The Lambda's timeout is 300s
(5 min); the `duration-near-timeout` alarm fires at 240s.

### The five alarms

All five route to the `diamond-iq-alerts` SNS topic and email the
subscriber. State-transition emails arrive within ~1-2 min of the
breach.

#### `diamond-iq-generate-daily-content-bedrock-failures`

- **What triggers it:** the custom metric `BedrockFailures` (sum) is
  greater than 0 in a 1-hour window.
- **What it means:** the Lambda is running but at least one
  InvokeModel call returned an error.
- **First check:** AWS Bedrock service status — invoke the model
  directly from your laptop with a tiny payload and inspect the
  error. If it returns ThrottlingException, you're hitting
  account-level quota. If it returns AccessDenied, IAM is the issue.
- **Second check:** the Lambda's CloudWatch logs filtered by error
  code:
  `aws logs tail /aws/lambda/diamond-iq-generate-daily-content --since 2h --filter-pattern "ThrottlingException"`.
  Each failure logs structured fields including `error_code` and `sk`.
- **Common causes & fixes:**
  - Daily token quota locked at 0 → file an AWS Support ticket;
    this is account-level state, not IAM. See ADR 008.
  - Per-minute rate exceeded → reduce concurrency (currently
    sequential, so this is unlikely).
  - Use-case form not approved → check Bedrock console.
  - Region mismatch → the inference profile must live in
    `us-east-1`; check the `BEDROCK_MODEL_ID` env var on the function.

#### `diamond-iq-generate-daily-content-dynamodb-failures`

- **What triggers it:** the custom metric `DynamoDBFailures` (sum)
  greater than 0 in a 1-hour window.
- **What it means:** Bedrock generated content but DynamoDB rejected
  the write. Worse than Bedrock failures because money was spent on
  tokens that didn't make it to a row.
- **First check:** does the games table still exist?
  `aws dynamodb describe-table --table-name diamond-iq-games`.
- **Second check:** Lambda logs for `DynamoDB put_content_item failed`:
  `aws logs tail /aws/lambda/diamond-iq-generate-daily-content --since 2h --filter-pattern "put_content_item failed"`.
- **Common causes & fixes:**
  - IAM scope changed (someone narrowed the policy) → the content
    Lambda needs `dynamodb:PutItem` on the games-table ARN.
  - Account-level write throttling → unlikely under PAY_PER_REQUEST,
    but check `ConsumedWriteCapacityUnits` and
    `WriteThrottleEvents` for the table.
  - Item too large → the only large field is `text`; check whether
    a recap exceeded 400 KB (DynamoDB item limit). Truncation should
    happen via `max_tokens`; if hit, lower it.

#### `diamond-iq-generate-daily-content-errors`

- **What triggers it:** the AWS-default Lambda `Errors` metric > 0 in
  a 5-min window.
- **What it means:** an unhandled exception escaped the per-item
  try/except. The handler catches Bedrock and DynamoDB errors per
  item, so this only fires on truly unexpected failures —
  ImportError, missing env var, malformed event payload.
- **First check:** the most recent error log line.
  `aws logs tail /aws/lambda/diamond-iq-generate-daily-content --since 30m --format short`
  and look for Python tracebacks.
- **Common causes:** recent deploy broke imports, env var
  `BEDROCK_MODEL_ID` or `GAMES_TABLE_NAME` was unset. Roll back
  the offending commit or fix the env var via Terraform.

#### `diamond-iq-generate-daily-content-duration-near-timeout`

- **What triggers it:** the AWS-default `Duration` metric (max) is
  greater than 240,000 ms (4 min) in a 5-min window. Lambda's
  timeout is 300s.
- **What it means:** something is making each Bedrock call slow, or
  there are way more games than usual.
- **First check:** is Bedrock latency elevated? Look at the
  `ModelInvocationLatency` metric in the
  [Bedrock console](https://us-east-1.console.aws.amazon.com/bedrock/home).
- **Second check:** how many items did the run try to generate?
  `aws logs tail /aws/lambda/diamond-iq-generate-daily-content --since 1h --filter-pattern "Daily content generation complete"`
  and inspect `expected_items`.
- **Common causes:** Bedrock cross-region routing routed to a
  congested region; doubleheader days inflate the Final/Preview
  counts beyond ~25; or `MAX_TOKENS_*` constants were bumped without
  thinking about latency.
- **Mitigation:** if duration is genuinely too high, raise the
  Lambda timeout in `infrastructure/main.tf` and tune the alarm
  threshold accordingly.

#### `diamond-iq-generate-daily-content-invocations-zero`

- **What triggers it:** `Invocations` metric is `<= 0` in a 24-hour
  window.
- **What it means:** EventBridge stopped firing the Lambda. Three
  scheduled triggers should produce 3 invocations per 24h.
- **First check:**
  `aws events list-rules --name-prefix diamond-iq-content` —
  expect three ENABLED rules.
- **Second check:** rule targets are wired:
  `aws events list-targets-by-rule --rule diamond-iq-content-15-utc`.
- **Common causes:** someone disabled an EventBridge rule, the
  `lambda:InvokeFunction` permission for the rule was removed, the
  Lambda was renamed, or the function itself was deleted.

### Manual re-trigger

Use the local invoke script for ad-hoc runs and date backfills:

```bash
# Default: today UTC
python scripts/invoke_generate_locally.py

# Backfill a specific date (e.g., regenerate yesterday's content)
python scripts/invoke_generate_locally.py --date 2026-04-25
```

The script invokes the deployed Lambda via boto3, waits for the
synchronous response, pretty-prints the result, and exits with
status 0 on success or status 1 on Lambda failure. AWS credentials
come from the environment (default boto3 credential resolution).

For one-off invocations without the helper script:

```bash
aws lambda invoke \
  --region us-east-1 \
  --function-name diamond-iq-generate-daily-content \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  --cli-read-timeout 360 \
  /tmp/content-result.json
cat /tmp/content-result.json
```

Expected success output:

```json
{
  "ok": true,
  "date": "2026-04-26",
  "expected_items": 17,
  "items_written": 17,
  "items_skipped": 0,
  "bedrock_failures": 0,
  "dynamodb_failures": 0
}
```

Expected throttled output (current state until AWS Support clears
daily quota):

```json
{
  "ok": false,
  "expected_items": 17,
  "items_written": 0,
  "bedrock_failures": 17,
  "dynamodb_failures": 0
}
```

### Verifying content was generated correctly

Three independent checks, in order of speed:

```bash
# 1. Direct DynamoDB query for the date partition.
aws dynamodb query \
  --region us-east-1 \
  --table-name diamond-iq-games \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"CONTENT#2026-04-26"}}' \
  --projection-expression "SK,content_type,game_pk" \
  --output table

# 2. The API endpoint the frontend uses.
curl https://7x9tjaks0d.execute-api.us-east-1.amazonaws.com/content/today | python -m json.tool

# 3. Frontend visual check. Run the dev server and scroll to the
#    "Today's Featured Matchups" hero — placeholder copy means no
#    content yet, real italicized prose means content is live.
cd frontend && npm run dev
# Then open http://localhost:5173
```

If the API returns empty arrays but DynamoDB has items, the API
Lambda's IAM probably cannot read CONTENT-prefixed items (it should —
same table ARN — but verify via
`aws iam get-role-policy --role-name diamond-iq-api-scoreboard-role --policy-name diamond-iq-api-scoreboard-policy`).

### Common failure modes and recovery

#### Bedrock daily token quota throttle (current state)

- **Symptom:** `bedrock-failures` alarm fires every hour after the
  scheduled tick. Email pair: ALARM at minute ~5, sometimes followed
  by OK if the next tick somehow squeezed through. Lambda summary
  shows `ok=false, bedrock_failures=N, items_written=0`.
- **Action:** none from your side. AWS Support is reviewing the
  daily quota. Until they clear it, the alarm is doing its job by
  truthfully telling you the Lambda is blocked. Do not silence the
  alarm — when the quota clears, the alarm will self-resolve to
  OK and you will see the transition.

#### Quota cleared but Lambda still failing

If the support ticket clears and the Lambda still emits
ThrottlingException, work down this checklist:

```bash
# IAM: does the role have InvokeModel against the right ARNs?
aws iam get-role-policy \
  --role-name diamond-iq-generate-daily-content-role \
  --policy-name diamond-iq-generate-daily-content-policy \
  | grep -A5 Bedrock

# Model access in the Bedrock console:
# https://us-east-1.console.aws.amazon.com/bedrock/home
# → Model access → Anthropic Claude Sonnet 4.6 should be "Access granted".

# Region check — inference profile must live in us-east-1, model id
# must be exactly us.anthropic.claude-sonnet-4-6
aws lambda get-function-configuration \
  --region us-east-1 \
  --function-name diamond-iq-generate-daily-content \
  --query 'Environment.Variables.BEDROCK_MODEL_ID'

# Use-case form: account-level prerequisite, not IAM.
# https://us-east-1.console.aws.amazon.com/bedrock/home → Model access
```

If all four check out and the Lambda still fails, the issue is
likely transient — wait 15 minutes and retry via
`scripts/invoke_generate_locally.py`.

#### DynamoDB write failures

- **Symptom:** `dynamodb-failures > 0`, `items_written < expected`.
  Means we paid for tokens but lost the write.
- **First check:** does the table exist and is it ACTIVE?
  `aws dynamodb describe-table --table-name diamond-iq-games --query 'Table.TableStatus'`
- **Second check:** does the Lambda role still have PutItem on it?
  Should match the policy in `infrastructure/main.tf` —
  `dynamodb:PutItem` on `module.dynamodb.table_arn`.
- **Recovery:** once the underlying issue is fixed, just wait — the
  next scheduled tick will idempotently fill in the missing rows.
