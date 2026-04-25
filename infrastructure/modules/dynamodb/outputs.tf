output "table_name" {
  description = "Name of the games table."
  value       = aws_dynamodb_table.games.name
}

output "table_arn" {
  description = "ARN of the games table."
  value       = aws_dynamodb_table.games.arn
}
