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
