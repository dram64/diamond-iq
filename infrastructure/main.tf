###############################################################################
# Diamond IQ — main infrastructure stack.
#
# Deploys: DynamoDB games table, two Lambda functions (ingest + API),
# API Gateway HTTP API, EventBridge 1-minute schedule, GitHub OIDC
# deploy role.
#
# State lives in S3 (created by infrastructure/bootstrap/).
###############################################################################

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {
    bucket         = "diamond-iq-tfstate-334856751632"
    key            = "main/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "diamond-iq-tfstate-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "diamond-iq"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id               = data.aws_caller_identity.current.account_id
  name_prefix              = "diamond-iq"
  games_table_name         = "${local.name_prefix}-games"
  connections_table_name   = "${local.name_prefix}-connections"
  ingest_function_name     = "${local.name_prefix}-ingest-live-games"
  api_function_name        = "${local.name_prefix}-api-scoreboard"
  content_function_name    = "${local.name_prefix}-generate-daily-content"
  api_name                 = "${local.name_prefix}-api"
  ingest_rule_name         = "${local.name_prefix}-ingest-schedule"
  github_deploy_role       = "${local.name_prefix}-github-deploy"
  state_bucket_name        = "diamond-iq-tfstate-${local.account_id}"
  lock_table_name          = "diamond-iq-tfstate-locks"
  shared_dir               = "${path.module}/../functions/shared"
  ingest_source_dir        = "${path.module}/../functions/ingest_live_games"
  api_source_dir           = "${path.module}/../functions/api_scoreboard"
  content_source_dir       = "${path.module}/../functions/generate_daily_content"
  ws_connect_source_dir    = "${path.module}/../functions/ws_connect"
  ws_disconnect_source_dir = "${path.module}/../functions/ws_disconnect"
  ws_default_source_dir    = "${path.module}/../functions/ws_default"

  ws_connect_function_name    = "${local.name_prefix}-ws-connect"
  ws_disconnect_function_name = "${local.name_prefix}-ws-disconnect"
  ws_default_function_name    = "${local.name_prefix}-ws-default"

  stream_processor_source_dir    = "${path.module}/../functions/stream_processor"
  stream_processor_function_name = "${local.name_prefix}-stream-processor"

  # 15:00, 16:00, 17:00 UTC — three idempotent triggers per day. The
  # first tick generates content; later ticks no-op via the handler's
  # existing-SK check, but stand by to fill in any items the earlier
  # tick missed (Bedrock throttle, transient DynamoDB error, etc.).
  content_schedule_hours_utc = [15, 16, 17]
}

###############################################################################
# DynamoDB
###############################################################################

module "dynamodb" {
  source     = "./modules/dynamodb"
  table_name = local.games_table_name
}

###############################################################################
# DynamoDB connections table — backs the WebSocket pipeline (Option 4).
#
# Composite key:
#   PK = connection_id           (the API Gateway WebSocket connection id)
#   SK = "META"                  (the connection record itself)
#      | "GAME#<game_pk>"        (one row per per-game subscription)
#
# GSI "by-game":
#   PK = game_pk_str             (string-typed game_pk for GSI)
#   SK = connection_id           (back-reference to the connection)
#
# The META row holds the WebSocket endpoint metadata
# (domain_name + stage + connected_at_utc) the stream processor needs to
# build PostToConnection calls. Subscription rows project sparsely to the
# GSI — META rows have no game_pk_str attribute and stay out of the GSI.
#
# TTL is 4 hours from connect time on every row, so a client that drops
# without sending $disconnect cleans up automatically.
###############################################################################

resource "aws_dynamodb_table" "connections" {
  name         = local.connections_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "game_pk_str"
    type = "S"
  }

  global_secondary_index {
    name            = "by-game"
    hash_key        = "game_pk_str"
    range_key       = "PK"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }
}

###############################################################################
# Ingest Lambda — write access to the games table only.
###############################################################################

data "aws_iam_policy_document" "ingest_policy" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:DescribeTable",
    ]
    resources = [module.dynamodb.table_arn]
  }
}

module "lambda_ingest" {
  source = "./modules/lambda"

  function_name = local.ingest_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.ingest_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    GAMES_TABLE_NAME = module.dynamodb.table_name
  }

  timeout             = 60
  memory_size         = 512
  iam_policy_document = data.aws_iam_policy_document.ingest_policy.json
}

###############################################################################
# API Lambda — read-only access to the games table.
###############################################################################

data "aws_iam_policy_document" "api_policy" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
    ]
    resources = [module.dynamodb.table_arn]
  }
}

module "lambda_api" {
  source = "./modules/lambda"

  function_name = local.api_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.api_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    GAMES_TABLE_NAME = module.dynamodb.table_name
  }

  timeout             = 10
  memory_size         = 256
  iam_policy_document = data.aws_iam_policy_document.api_policy.json
}

###############################################################################
# API Gateway HTTP API
###############################################################################

module "api_gateway" {
  source = "./modules/api-gateway"

  api_name              = local.api_name
  api_lambda_name       = module.lambda_api.function_name
  api_lambda_invoke_arn = module.lambda_api.invoke_arn
  cors_allow_origins    = [var.frontend_origin]
}

###############################################################################
# Content-generation Lambda — read games, write content items, call Bedrock.
#
# Bedrock invocation is allowed against the same cross-region inference profile
# the 9A smoke-test Lambda used. The IAM policy must list both the profile ARN
# and the underlying foundation-model ARNs in every region the profile may
# route to (us-east-1, us-east-2, us-west-2).
###############################################################################

# NOTE: `local.bedrock_inference_profile_id`, `_arn`, and
# `bedrock_foundation_model_arns` are defined in `test_bedrock_stub.tf`. We
# intentionally reference the same values here so that the 9A smoke-test
# stub and the 9C content Lambda share one source of truth for the model
# ID. When the 9A stub is removed at close-out, those locals must be
# moved into this file as part of that cleanup commit.

data "aws_iam_policy_document" "content_policy" {
  statement {
    sid    = "GamesAndContentTableAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [module.dynamodb.table_arn]
  }

  statement {
    sid     = "BedrockInvokeClaudeSonnet46"
    effect  = "Allow"
    actions = ["bedrock:InvokeModel"]
    resources = concat(
      [local.bedrock_inference_profile_arn],
      local.bedrock_foundation_model_arns,
    )
  }

  # Custom CloudWatch metrics. PutMetricData has no resource-level ARNs; we
  # scope to our namespace via a condition so this Lambda can't pollute
  # other namespaces.
  statement {
    sid       = "PublishCustomMetricsToDiamondIQContent"
    effect    = "Allow"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["DiamondIQ/Content"]
    }
  }
}

module "lambda_content" {
  source = "./modules/lambda"

  function_name = local.content_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.content_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    GAMES_TABLE_NAME = module.dynamodb.table_name
    BEDROCK_MODEL_ID = local.bedrock_inference_profile_id
  }

  timeout             = 300
  memory_size         = 512
  iam_policy_document = data.aws_iam_policy_document.content_policy.json
}

resource "aws_cloudwatch_event_rule" "content_schedule" {
  for_each = toset([for h in local.content_schedule_hours_utc : tostring(h)])

  name                = "${local.name_prefix}-content-${each.key}-utc"
  description         = "Daily content generation trigger at ${each.key}:00 UTC."
  schedule_expression = "cron(0 ${each.key} * * ? *)"
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "content_lambda" {
  for_each = aws_cloudwatch_event_rule.content_schedule

  rule      = each.value.name
  target_id = "content-lambda"
  arn       = module.lambda_content.function_arn
}

resource "aws_lambda_permission" "content_events_invoke" {
  for_each = aws_cloudwatch_event_rule.content_schedule

  statement_id  = "AllowEventBridgeInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_content.function_name
  principal     = "events.amazonaws.com"
  source_arn    = each.value.arn
}

###############################################################################
# EventBridge schedule for the ingest Lambda
###############################################################################

module "events" {
  source = "./modules/events"

  rule_name          = local.ingest_rule_name
  ingest_lambda_name = module.lambda_ingest.function_name
  ingest_lambda_arn  = module.lambda_ingest.function_arn
}

###############################################################################
# WebSocket Lambdas — connect, disconnect, default (subscribe/unsubscribe).
#
# Each gets minimum-privilege DynamoDB on the connections table only.
# connect needs PutItem (META row); disconnect needs Query + DeleteItem
# (find all rows for connection, delete each); default needs PutItem (subscribe)
# and DeleteItem (unsubscribe).
###############################################################################

data "aws_iam_policy_document" "ws_connect_policy" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.connections.arn]
  }
}

module "lambda_ws_connect" {
  source = "./modules/lambda"

  function_name = local.ws_connect_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.ws_connect_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
  }

  timeout             = 5
  memory_size         = 128
  iam_policy_document = data.aws_iam_policy_document.ws_connect_policy.json
}

data "aws_iam_policy_document" "ws_disconnect_policy" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:Query", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.connections.arn]
  }
}

module "lambda_ws_disconnect" {
  source = "./modules/lambda"

  function_name = local.ws_disconnect_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.ws_disconnect_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
  }

  timeout             = 5
  memory_size         = 128
  iam_policy_document = data.aws_iam_policy_document.ws_disconnect_policy.json
}

data "aws_iam_policy_document" "ws_default_policy" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.connections.arn]
  }
}

module "lambda_ws_default" {
  source = "./modules/lambda"

  function_name = local.ws_default_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.ws_default_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
  }

  timeout             = 5
  memory_size         = 128
  iam_policy_document = data.aws_iam_policy_document.ws_default_policy.json
}

###############################################################################
# Stream-processor Lambda — fans out DynamoDB Streams MODIFYs to subscribed
# WebSocket clients via the API Gateway Management API.
#
# Trigger: DynamoDB Streams from the games table. Diff old vs new image,
# query connections by-game GSI, parallel PostToConnection. 410 Gone on
# any connection deletes that connection's rows from the table.
###############################################################################

data "aws_iam_policy_document" "stream_processor_policy" {
  # Stream consumption — scoped to the games-table stream.
  statement {
    sid    = "DynamoDBStreamConsume"
    effect = "Allow"
    actions = [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
    ]
    resources = [module.dynamodb.stream_arn]
  }

  # ListStreams accepts no resource scoping. Filtering happens at runtime.
  statement {
    sid       = "DynamoDBListStreams"
    effect    = "Allow"
    actions   = ["dynamodb:ListStreams"]
    resources = ["*"]
  }

  # Connections-table read (GSI Query) and stale-connection cleanup.
  statement {
    sid    = "DynamoDBConnectionsAccess"
    effect = "Allow"
    actions = [
      "dynamodb:Query",
      "dynamodb:DeleteItem",
    ]
    resources = [
      aws_dynamodb_table.connections.arn,
      "${aws_dynamodb_table.connections.arn}/index/by-game",
    ]
  }

  # PostToConnection on the WebSocket API. The wildcard at the end covers
  # every connection id under the production stage.
  statement {
    sid       = "WebSocketManageConnections"
    effect    = "Allow"
    actions   = ["execute-api:ManageConnections"]
    resources = ["arn:aws:execute-api:${var.aws_region}:${local.account_id}:${aws_apigatewayv2_api.ws.id}/${aws_apigatewayv2_stage.ws.name}/POST/@connections/*"]
  }
}

module "lambda_stream_processor" {
  source = "./modules/lambda"

  function_name = local.stream_processor_function_name
  handler       = "handler.lambda_handler"
  source_dir    = local.stream_processor_source_dir
  shared_dir    = local.shared_dir

  environment_variables = {
    CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
    WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
  }

  timeout             = 30
  memory_size         = 256
  iam_policy_document = data.aws_iam_policy_document.stream_processor_policy.json
}

resource "aws_lambda_event_source_mapping" "stream_processor" {
  event_source_arn                   = module.dynamodb.stream_arn
  function_name                      = module.lambda_stream_processor.function_arn
  starting_position                  = "LATEST"
  batch_size                         = 10
  maximum_batching_window_in_seconds = 1
  parallelization_factor             = 10
  bisect_batch_on_function_error     = true
}

###############################################################################
# WAF (Security Layer Phase 1) — fronts the API Gateway via CloudFront.
#
# WAFv2 cannot attach to API Gateway HTTP API directly (only REST API).
# CloudFront is the standard pattern that unlocks WAF for HTTP API origins;
# see infrastructure/cloudfront.tf for the distribution.
###############################################################################

module "waf" {
  source = "./modules/waf"

  name_prefix          = local.name_prefix
  scope                = "CLOUDFRONT"
  managed_rule_actions = var.managed_rule_actions
  rate_limit_default   = var.rate_limit_default
  rate_limit_sensitive = var.rate_limit_sensitive
  enable_geo_blocking  = var.enable_geo_blocking
  blocked_countries    = var.blocked_countries
  blocked_user_agents  = var.blocked_user_agents
  dev_allow_list_cidrs = var.dev_allow_list_cidrs
}

###############################################################################
# GitHub Actions OIDC deploy role
###############################################################################

module "oidc" {
  source = "./modules/oidc"

  github_repo       = var.github_repo
  role_name         = local.github_deploy_role
  name_prefix       = local.name_prefix
  account_id        = local.account_id
  aws_region        = var.aws_region
  state_bucket_name = local.state_bucket_name
  lock_table_name   = local.lock_table_name
}
