# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - TERRAFORM OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════════
# All important values exported for:
# - CI/CD pipelines
# - Application configuration
# - Debugging and monitoring
# - Cross-stack references
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# ENVIRONMENT INFO
# ─────────────────────────────────────────────────────────────────────────────────

output "environment" {
  description = "Current deployment environment"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "account_id" {
  description = "AWS account ID"
  value       = local.account_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# VPC & NETWORKING
# ─────────────────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (for ECS)"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "Database subnet IDs (for RDS/Redis)"
  value       = aws_subnet.database[*].id
}

output "availability_zones" {
  description = "Availability zones used"
  value       = local.azs
}

output "nat_gateway_ips" {
  description = "NAT Gateway public IPs (for whitelisting)"
  value       = aws_eip.nat[*].public_ip
}

# ─────────────────────────────────────────────────────────────────────────────────
# LOAD BALANCER
# ─────────────────────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB Route53 zone ID"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix (for CloudWatch metrics)"
  value       = aws_lb.main.arn_suffix
}

output "target_group_arn" {
  description = "Target group ARN"
  value       = aws_lb_target_group.backend.arn
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "https://${var.domain_name}"
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECS
# ─────────────────────────────────────────────────────────────────────────────────

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "ecs_task_definition_arn" {
  description = "ECS task definition ARN"
  value       = aws_ecs_task_definition.backend.arn
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECR
# ─────────────────────────────────────────────────────────────────────────────────

output "ecr_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN"
  value       = aws_ecr_repository.backend.arn
}

output "ecr_worker_repository_url" {
  description = "ECR repository URL for worker"
  value       = aws_ecr_repository.worker.repository_url
}

# ─────────────────────────────────────────────────────────────────────────────────
# RDS
# ─────────────────────────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS instance hostname"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.main.db_name
}

output "rds_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.identifier
}

output "rds_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

# Note: DATABASE_URL is in Secrets Manager, not exposed here for security

# ─────────────────────────────────────────────────────────────────────────────────
# ELASTICACHE (REDIS)
# ─────────────────────────────────────────────────────────────────────────────────

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = var.redis_port
}

# Note: REDIS_URL is in Secrets Manager, not exposed here for security

# ─────────────────────────────────────────────────────────────────────────────────
# S3 BUCKETS
# ─────────────────────────────────────────────────────────────────────────────────

output "s3_product_images_bucket" {
  description = "S3 bucket name for product images"
  value       = aws_s3_bucket.product_images.id
}

output "s3_product_images_domain" {
  description = "S3 bucket domain for product images"
  value       = aws_s3_bucket.product_images.bucket_regional_domain_name
}

output "s3_user_documents_bucket" {
  description = "S3 bucket name for user documents"
  value       = aws_s3_bucket.user_documents.id
}

output "s3_exports_bucket" {
  description = "S3 bucket name for exports"
  value       = aws_s3_bucket.exports.id
}

output "s3_alb_logs_bucket" {
  description = "S3 bucket name for ALB logs"
  value       = aws_s3_bucket.alb_logs.id
}

output "cloudfront_distribution_domain" {
  description = "CloudFront distribution domain (if enabled)"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.product_images[0].domain_name : null
}

# ─────────────────────────────────────────────────────────────────────────────────
# SECRETS MANAGER
# ─────────────────────────────────────────────────────────────────────────────────

output "secrets_db_credentials_arn" {
  description = "Secrets Manager ARN for database credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "secrets_redis_credentials_arn" {
  description = "Secrets Manager ARN for Redis credentials"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "secrets_jwt_arn" {
  description = "Secrets Manager ARN for JWT secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "secrets_stripe_arn" {
  description = "Secrets Manager ARN for Stripe secret"
  value       = aws_secretsmanager_secret.stripe_secret.arn
}

output "secrets_prefix" {
  description = "Secrets Manager prefix for this environment"
  value       = "${local.name_prefix}/"
}

# ─────────────────────────────────────────────────────────────────────────────────
# KMS KEYS
# ─────────────────────────────────────────────────────────────────────────────────

output "kms_rds_key_arn" {
  description = "KMS key ARN for RDS encryption"
  value       = aws_kms_key.rds.arn
}

output "kms_secrets_key_arn" {
  description = "KMS key ARN for Secrets Manager"
  value       = aws_kms_key.secrets.arn
}

output "kms_s3_key_arn" {
  description = "KMS key ARN for S3 encryption"
  value       = aws_kms_key.s3.arn
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH
# ─────────────────────────────────────────────────────────────────────────────────

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for ECS"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.ecs.arn
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = length(aws_sns_topic.alerts) > 0 ? aws_sns_topic.alerts[0].arn : null
}

# ─────────────────────────────────────────────────────────────────────────────────
# SECURITY GROUPS
# ─────────────────────────────────────────────────────────────────────────────────

output "security_group_alb_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "security_group_ecs_id" {
  description = "ECS security group ID"
  value       = aws_security_group.ecs.id
}

output "security_group_rds_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "security_group_redis_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

# ─────────────────────────────────────────────────────────────────────────────────
# IAM
# ─────────────────────────────────────────────────────────────────────────────────

output "github_actions_role_arn" {
  description = "GitHub Actions IAM role ARN"
  value       = aws_iam_role.github_actions.arn
}

output "github_oidc_provider_arn" {
  description = "GitHub OIDC provider ARN"
  value       = aws_iam_openid_connect_provider.github.arn
}

# ─────────────────────────────────────────────────────────────────────────────────
# ACM / SSL
# ─────────────────────────────────────────────────────────────────────────────────

output "acm_certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate.main.arn
}

output "acm_certificate_domain" {
  description = "ACM certificate domain"
  value       = aws_acm_certificate.main.domain_name
}

# ─────────────────────────────────────────────────────────────────────────────────
# USEFUL COMMANDS
# ─────────────────────────────────────────────────────────────────────────────────

output "useful_commands" {
  description = "Useful AWS CLI commands for this environment"
  value = {
    ecs_exec = "aws ecs execute-command --cluster ${aws_ecs_cluster.main.name} --task TASK_ID --container backend --interactive --command /bin/sh"

    view_logs = "aws logs tail ${aws_cloudwatch_log_group.ecs.name} --follow"

    get_db_password = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.db_credentials.id} --query SecretString --output text | jq -r .password"

    ecr_login = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"

    push_image = "docker push ${aws_ecr_repository.backend.repository_url}:latest"

    update_service = "aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.backend.name} --force-new-deployment"

    dashboard_url = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# DEPLOYMENT INFO
# ─────────────────────────────────────────────────────────────────────────────────

output "deployment_info" {
  description = "Deployment information summary"
  value = {
    environment    = var.environment
    api_url        = "https://${var.domain_name}"
    alb_dns        = aws_lb.main.dns_name
    ecs_cluster    = aws_ecs_cluster.main.name
    ecs_service    = aws_ecs_service.backend.name
    ecr_repository = aws_ecr_repository.backend.repository_url
    log_group      = aws_cloudwatch_log_group.ecs.name
    dashboard      = aws_cloudwatch_dashboard.main.dashboard_name
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# COST ESTIMATION
# ─────────────────────────────────────────────────────────────────────────────────

output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    environment = var.environment
    estimate    = var.environment == "staging" ? "$180-220 USD/month" : "$850-1200 USD/month"
    breakdown = {
      ecs_fargate   = var.environment == "staging" ? "~$45" : "~$180-430"
      rds           = var.environment == "staging" ? "~$50" : "~$400"
      elasticache   = var.environment == "staging" ? "~$13" : "~$185"
      nat_gateways  = var.environment == "staging" ? "~$50" : "~$180"
      alb           = "~$25-65"
      s3            = "~$7-25"
      cloudwatch    = "~$5-25"
      secrets_kms   = "~$15-20"
    }
    notes = [
      "Costs scale with usage (data transfer, requests)",
      "ECS auto-scales based on CPU/Memory thresholds",
      "RDS storage auto-scales up to configured maximum",
      "Consider Reserved Instances for production (up to 60% savings)"
    ]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# OUTPUTS SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# Total outputs: 50+
#
# Categories:
# - Environment (3)
# - VPC & Networking (7)
# - Load Balancer (6)
# - ECS (6)
# - ECR (3)
# - RDS (6)
# - ElastiCache (3)
# - S3 (6)
# - Secrets Manager (5)
# - KMS (3)
# - CloudWatch (4)
# - Security Groups (4)
# - IAM (2)
# - ACM/SSL (2)
# - Utility (3)
#
# ─────────────────────────────────────────────────────────────────────────────────
