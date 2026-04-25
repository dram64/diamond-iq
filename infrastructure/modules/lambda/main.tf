###############################################################################
# Reusable Lambda module.
#
# Builds a deterministic deploy zip by combining the function's own source
# directory with the shared/ package vendored into the same zip. The shared
# code is symlink-staged into a temporary build directory so we can produce
# one archive that contains both `handler.py` (or whatever entrypoint) and
# `shared/*.py` at the zip root.
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

locals {
  build_dir = "${path.module}/.build/${var.function_name}"
  zip_path  = "${path.module}/.build/${var.function_name}.zip"
}

# Stage the function source plus the shared/ package into a single build dir.
# null_resource re-runs whenever any source file's hash changes.
resource "null_resource" "stage" {
  triggers = {
    function_hash = sha1(join("", [for f in fileset(var.source_dir, "**") : filesha1("${var.source_dir}/${f}")]))
    shared_hash   = sha1(join("", [for f in fileset(var.shared_dir, "**") : filesha1("${var.shared_dir}/${f}")]))
    build_dir     = local.build_dir
  }

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      rm -rf "${local.build_dir}"
      mkdir -p "${local.build_dir}/shared"
      cp -R "${var.source_dir}/." "${local.build_dir}/"
      cp -R "${var.shared_dir}/." "${local.build_dir}/shared/"
      # Strip caches that local dev may have created
      find "${local.build_dir}" -type d -name '__pycache__' -prune -exec rm -rf {} +
      find "${local.build_dir}" -type d -name '.pytest_cache' -prune -exec rm -rf {} +
    EOT
  }
}

data "archive_file" "package" {
  type        = "zip"
  source_dir  = local.build_dir
  output_path = local.zip_path

  depends_on = [null_resource.stage]
}

###############################################################################
# IAM
###############################################################################

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "function" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

# Caller-supplied policy (DynamoDB scoped to the games table, etc.).
resource "aws_iam_role_policy" "function" {
  name   = "${var.function_name}-policy"
  role   = aws_iam_role.function.id
  policy = var.iam_policy_document
}

# Standard Lambda → CloudWatch Logs permissions.
resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.function.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

###############################################################################
# Log group
###############################################################################

resource "aws_cloudwatch_log_group" "function" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days
}

###############################################################################
# Function
###############################################################################

resource "aws_lambda_function" "function" {
  function_name    = var.function_name
  role             = aws_iam_role.function.arn
  handler          = var.handler
  runtime          = "python3.12"
  filename         = data.archive_file.package.output_path
  source_code_hash = data.archive_file.package.output_base64sha256
  timeout          = var.timeout
  memory_size      = var.memory_size

  environment {
    variables = var.environment_variables
  }

  # Make sure the log group exists (and is set to our retention) before the
  # function — otherwise Lambda creates a default group with infinite retention.
  depends_on = [aws_cloudwatch_log_group.function]
}
