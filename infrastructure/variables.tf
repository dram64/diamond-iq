variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment tag."
  type        = string
  default     = "prod"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) trusted by the OIDC deploy role."
  type        = string
  default     = "dram64/diamond-iq"
}

variable "frontend_origin" {
  description = "Allowed CORS origin for the HTTP API."
  type        = string
  default     = "http://localhost:5173"
}

variable "alert_email" {
  description = "Email address subscribed to operational alerts (SNS). Supplied via terraform.tfvars (gitignored) or TF_VAR_alert_email; intentionally has no default so a missing value fails the plan loudly."
  type        = string
  # No default — must be set externally so secrets/PII never land in source.
}
