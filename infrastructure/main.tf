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
  account_id           = data.aws_caller_identity.current.account_id
  name_prefix          = "diamond-iq"
  games_table_name     = "${local.name_prefix}-games"
  ingest_function_name = "${local.name_prefix}-ingest-live-games"
  api_function_name    = "${local.name_prefix}-api-scoreboard"
  api_name             = "${local.name_prefix}-api"
  ingest_rule_name     = "${local.name_prefix}-ingest-schedule"
  github_deploy_role   = "${local.name_prefix}-github-deploy"
  state_bucket_name    = "diamond-iq-tfstate-${local.account_id}"
  lock_table_name      = "diamond-iq-tfstate-locks"
  shared_dir           = "${path.module}/../functions/shared"
  ingest_source_dir    = "${path.module}/../functions/ingest_live_games"
  api_source_dir       = "${path.module}/../functions/api_scoreboard"
}

###############################################################################
# DynamoDB
###############################################################################

module "dynamodb" {
  source     = "./modules/dynamodb"
  table_name = local.games_table_name
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
# EventBridge schedule for the ingest Lambda
###############################################################################

module "events" {
  source = "./modules/events"

  rule_name          = local.ingest_rule_name
  ingest_lambda_name = module.lambda_ingest.function_name
  ingest_lambda_arn  = module.lambda_ingest.function_arn
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
