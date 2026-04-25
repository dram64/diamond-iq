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
