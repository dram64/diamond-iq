variable "function_name" {
  description = "Name of the Lambda function (also used for IAM role and log group)."
  type        = string
}

variable "handler" {
  description = "Lambda handler entrypoint (e.g. handler.lambda_handler)."
  type        = string
}

variable "source_dir" {
  description = "Path to the function's source directory (contains the handler module)."
  type        = string
}

variable "shared_dir" {
  description = "Path to the shared/ package vendored into every Lambda zip."
  type        = string
}

variable "environment_variables" {
  description = "Environment variables passed to the function."
  type        = map(string)
  default     = {}
}

variable "timeout" {
  description = "Lambda timeout in seconds."
  type        = number
  default     = 30
}

variable "memory_size" {
  description = "Lambda memory size in MB."
  type        = number
  default     = 256
}

variable "iam_policy_document" {
  description = "JSON IAM policy document attached to the function's role."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the function's log group."
  type        = number
  default     = 14
}

variable "reserved_concurrent_executions" {
  description = "Per-function concurrency reservation. Cap on simultaneous in-flight invocations of THIS function — caps cost-runaway if a misbehaving trigger or recursive loop spikes invocation count. The default 10 is wildly above portfolio-scale needs; lower it for hot Lambdas only after measuring."
  type        = number
  default     = 10
}
