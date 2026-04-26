###############################################################################
# Operational alerting — SNS topic + CloudWatch metric alarms.
#
# Scope (this commit): the daily content Lambda only. Future commits can
# add ingest- and api-Lambda alarms by wiring more aws_cloudwatch_metric_alarm
# resources to the same `aws_sns_topic.alerts` ARN.
#
# Email subscription requires a one-time confirmation click in the inbox
# of `var.alert_email`. The email value is supplied via terraform.tfvars
# (gitignored) or TF_VAR_alert_email — never committed.
###############################################################################

resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
  # AWS rejects a subscription update that would re-trigger a confirm-email
  # for a previously-confirmed endpoint. Setting confirmation_timeout_in_minutes
  # high gives the human plenty of time to click the link after first deploy.
  confirmation_timeout_in_minutes = 60
}

# Allow CloudWatch alarms in this account to publish to the topic.
data "aws_iam_policy_document" "alerts_topic" {
  statement {
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts_topic.json
}

###############################################################################
# Alarms — diamond-iq-generate-daily-content
###############################################################################

# (a) Any unhandled exception in a 5-minute window. The handler catches
# Bedrock and DynamoDB errors per-item, so this metric only goes up on
# truly-unexpected failures (import errors, missing env, etc.).
resource "aws_cloudwatch_metric_alarm" "content_errors" {
  alarm_name          = "${local.content_function_name}-errors"
  alarm_description   = "Unhandled exceptions in the daily content Lambda."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    FunctionName = local.content_function_name
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# (b) Duration approaching the 300s function timeout. 240,000 ms = 4 min.
resource "aws_cloudwatch_metric_alarm" "content_duration" {
  alarm_name          = "${local.content_function_name}-duration-near-timeout"
  alarm_description   = "Daily content Lambda took >4 min in a 5-min window (timeout is 5 min)."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 240000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    FunctionName = local.content_function_name
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# (c) Custom metric: bedrock_failures > 0 over a 1-hour window. While the
# AWS daily-token quota is locked, this WILL fire on every scheduled tick
# until quota clears — that's the alarm doing its job.
resource "aws_cloudwatch_metric_alarm" "content_bedrock_failures" {
  alarm_name          = "${local.content_function_name}-bedrock-failures"
  alarm_description   = "Daily content Lambda is running but Bedrock invocations are failing."
  namespace           = "DiamondIQ/Content"
  metric_name         = "BedrockFailures"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LambdaFunction = local.content_function_name
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# (d) Custom metric: dynamodb_failures > 0 over a 1-hour window.
resource "aws_cloudwatch_metric_alarm" "content_dynamodb_failures" {
  alarm_name          = "${local.content_function_name}-dynamodb-failures"
  alarm_description   = "Daily content Lambda generated content but DynamoDB writes failed."
  namespace           = "DiamondIQ/Content"
  metric_name         = "DynamoDBFailures"
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LambdaFunction = local.content_function_name
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# (e) Invocations <= 0 over a 24-hour window. EventBridge fires the Lambda
# 3x/day; a 24-hour zero-invocation window means EventBridge or the
# events-invoke IAM permission has broken. notBreaching on missing data
# avoids a false alarm during the first 24 hours after this alarm is created.
resource "aws_cloudwatch_metric_alarm" "content_invocations_zero" {
  alarm_name          = "${local.content_function_name}-invocations-zero"
  alarm_description   = "Daily content Lambda did not run in the last 24 hours — EventBridge schedule may be broken."
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  statistic           = "Sum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "LessThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    FunctionName = local.content_function_name
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}
