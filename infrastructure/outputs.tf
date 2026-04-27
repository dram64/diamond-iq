output "api_endpoint" {
  description = "Public base URL for the HTTP API."
  value       = module.api_gateway.api_endpoint
}

output "games_table_name" {
  description = "Name of the games DynamoDB table."
  value       = module.dynamodb.table_name
}

output "ingest_lambda_name" {
  description = "Name of the ingest Lambda function."
  value       = module.lambda_ingest.function_name
}

output "api_lambda_name" {
  description = "Name of the API Lambda function."
  value       = module.lambda_api.function_name
}

output "github_deploy_role_arn" {
  description = "ARN of the GitHub Actions OIDC deploy role."
  value       = module.oidc.deploy_role_arn
}

output "ingest_schedule_rule_name" {
  description = "Name of the EventBridge rule that fires the ingest Lambda."
  value       = module.events.rule_name
}

output "cloudfront_url" {
  description = "Public CloudFront entry point fronting the API. Set frontend VITE_API_URL to this; the api_endpoint output is preserved as a documented bypass for ops debugging."
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL attached to the CloudFront distribution."
  value       = module.waf.web_acl_arn
}

output "waf_log_group_name" {
  description = "CloudWatch log group capturing WAF requests."
  value       = module.waf.log_group_name
}
