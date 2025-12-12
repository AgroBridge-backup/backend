# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - TERRAFORM VARIABLES
# ═══════════════════════════════════════════════════════════════════════════════
# All configurable parameters for staging and production environments
# Use terraform.tfvars or workspace-specific .tfvars files to override defaults
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# CORE CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (staging or production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "agrobridge"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.app_name))
    error_message = "App name must start with a letter and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "domain_name" {
  description = "Primary domain name for the API"
  type        = string
  default     = "api.agrobridge.io"
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for DNS records"
  type        = string
  default     = ""
}

# ─────────────────────────────────────────────────────────────────────────────────
# NETWORKING - VPC CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid CIDR block."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (ALB, NAT Gateways)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (ECS tasks)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets (RDS, ElastiCache)"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway (cost saving for staging)"
  type        = bool
  default     = false
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECS - CONTAINER CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────

variable "ecs_cpu" {
  description = "CPU units for ECS task (1 vCPU = 1024)"
  type        = map(number)
  default = {
    staging    = 1024  # 1 vCPU
    production = 2048  # 2 vCPU
  }
}

variable "ecs_memory" {
  description = "Memory (MB) for ECS task"
  type        = map(number)
  default = {
    staging    = 2048  # 2 GB
    production = 4096  # 4 GB
  }
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = map(number)
  default = {
    staging    = 1
    production = 2
  }
}

variable "ecs_min_capacity" {
  description = "Minimum number of ECS tasks for auto-scaling"
  type        = map(number)
  default = {
    staging    = 1
    production = 2
  }
}

variable "ecs_max_capacity" {
  description = "Maximum number of ECS tasks for auto-scaling"
  type        = map(number)
  default = {
    staging    = 3
    production = 10
  }
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 8080
}

variable "health_check_path" {
  description = "Path for ALB health checks"
  type        = string
  default     = "/api/health"
}

variable "health_check_grace_period" {
  description = "Seconds to wait before starting health checks"
  type        = number
  default     = 60
}

# ─────────────────────────────────────────────────────────────────────────────────
# AUTO-SCALING THRESHOLDS
# ─────────────────────────────────────────────────────────────────────────────────

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto-scaling"
  type        = number
  default     = 70
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto-scaling"
  type        = number
  default     = 80
}

variable "scale_in_cooldown" {
  description = "Cooldown period (seconds) after scale-in"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Cooldown period (seconds) after scale-out"
  type        = number
  default     = 60
}

# ─────────────────────────────────────────────────────────────────────────────────
# RDS - DATABASE CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class by environment"
  type        = map(string)
  default = {
    staging    = "db.t3.medium"    # 2 vCPU, 4 GB RAM - $50/month
    production = "db.r6g.xlarge"   # 4 vCPU, 32 GB RAM - $350/month
  }
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_name" {
  description = "Name of the default database"
  type        = string
  default     = "agrobridge"
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "db_allocated_storage" {
  description = "Initial storage allocation (GB)"
  type        = map(number)
  default = {
    staging    = 50
    production = 100
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum storage for auto-scaling (GB)"
  type        = map(number)
  default = {
    staging    = 100
    production = 500
  }
}

variable "db_backup_retention_period" {
  description = "Days to retain automated backups"
  type        = map(number)
  default = {
    staging    = 3
    production = 7
  }
}

variable "db_backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-05:00"  # 9-11 PM CST
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = map(bool)
  default = {
    staging    = false
    production = true
  }
}

variable "db_deletion_protection" {
  description = "Enable deletion protection"
  type        = map(bool)
  default = {
    staging    = false
    production = true
  }
}

variable "db_performance_insights" {
  description = "Enable Performance Insights"
  type        = map(bool)
  default = {
    staging    = false
    production = true
  }
}

variable "db_max_connections" {
  description = "Maximum database connections"
  type        = number
  default     = 200
}

# ─────────────────────────────────────────────────────────────────────────────────
# ELASTICACHE - REDIS CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type by environment"
  type        = map(string)
  default = {
    staging    = "cache.t3.micro"   # 0.5 GB - $12/month
    production = "cache.r6g.large"  # 13.07 GB - $180/month
  }
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters (nodes) in the replication group"
  type        = map(number)
  default = {
    staging    = 1
    production = 2
  }
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover (requires 2+ nodes)"
  type        = map(bool)
  default = {
    staging    = false
    production = true
  }
}

variable "redis_snapshot_retention" {
  description = "Days to retain Redis snapshots"
  type        = map(number)
  default = {
    staging    = 1
    production = 5
  }
}

variable "redis_snapshot_window" {
  description = "Daily time range for snapshots (UTC)"
  type        = string
  default     = "02:00-04:00"
}

# ─────────────────────────────────────────────────────────────────────────────────
# APPLICATION LOAD BALANCER
# ─────────────────────────────────────────────────────────────────────────────────

variable "alb_idle_timeout" {
  description = "Time (seconds) that a connection is allowed to be idle"
  type        = number
  default     = 60
}

variable "alb_deregistration_delay" {
  description = "Time (seconds) to drain connections during deregistration"
  type        = number
  default     = 30
}

variable "alb_stickiness_duration" {
  description = "Duration (seconds) for sticky sessions"
  type        = number
  default     = 3600  # 1 hour
}

variable "alb_health_check_interval" {
  description = "Interval (seconds) between health checks"
  type        = number
  default     = 30
}

variable "alb_health_check_timeout" {
  description = "Timeout (seconds) for health check response"
  type        = number
  default     = 5
}

variable "alb_healthy_threshold" {
  description = "Number of consecutive health checks to consider healthy"
  type        = number
  default     = 2
}

variable "alb_unhealthy_threshold" {
  description = "Number of consecutive health check failures to consider unhealthy"
  type        = number
  default     = 3
}

variable "ssl_policy" {
  description = "SSL policy for HTTPS listener"
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

# ─────────────────────────────────────────────────────────────────────────────────
# MONITORING & ALERTING
# ─────────────────────────────────────────────────────────────────────────────────

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = map(number)
  default = {
    staging    = 14
    production = 30
  }
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "alarm_phone" {
  description = "Phone number for critical alarms (E.164 format)"
  type        = string
  default     = ""
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights"
  type        = bool
  default     = true
}

# ─────────────────────────────────────────────────────────────────────────────────
# ALARM THRESHOLDS
# ─────────────────────────────────────────────────────────────────────────────────

variable "alarm_cpu_threshold" {
  description = "CPU utilization threshold for alarms (%)"
  type        = number
  default     = 80
}

variable "alarm_memory_threshold" {
  description = "Memory utilization threshold for alarms (%)"
  type        = number
  default     = 85
}

variable "alarm_5xx_threshold" {
  description = "Number of 5xx errors to trigger alarm"
  type        = number
  default     = 10
}

variable "alarm_db_cpu_threshold" {
  description = "RDS CPU utilization threshold for alarms (%)"
  type        = number
  default     = 75
}

variable "alarm_db_connections_threshold" {
  description = "RDS connections threshold for alarms"
  type        = number
  default     = 180
}

variable "alarm_db_storage_threshold" {
  description = "RDS free storage threshold for alarms (GB)"
  type        = number
  default     = 10
}

variable "alarm_redis_memory_threshold" {
  description = "Redis memory utilization threshold for alarms (%)"
  type        = number
  default     = 90
}

# ─────────────────────────────────────────────────────────────────────────────────
# S3 BUCKETS
# ─────────────────────────────────────────────────────────────────────────────────

variable "s3_product_images_bucket" {
  description = "S3 bucket name for product images"
  type        = string
  default     = "agrobridge-product-images"
}

variable "s3_user_documents_bucket" {
  description = "S3 bucket name for user documents"
  type        = string
  default     = "agrobridge-user-documents"
}

variable "s3_alb_logs_bucket" {
  description = "S3 bucket name for ALB access logs"
  type        = string
  default     = "agrobridge-alb-logs"
}

# ─────────────────────────────────────────────────────────────────────────────────
# SECRETS - PLACEHOLDERS (actual values in Secrets Manager)
# ─────────────────────────────────────────────────────────────────────────────────

variable "jwt_secret_length" {
  description = "Length of auto-generated JWT secret"
  type        = number
  default     = 64
}

variable "db_password_length" {
  description = "Length of auto-generated database password"
  type        = number
  default     = 32
}

variable "redis_auth_token_length" {
  description = "Length of auto-generated Redis auth token"
  type        = number
  default     = 32
}

# ─────────────────────────────────────────────────────────────────────────────────
# GITHUB ACTIONS - CI/CD
# ─────────────────────────────────────────────────────────────────────────────────

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = "agrobridge"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "backend"
}

# ─────────────────────────────────────────────────────────────────────────────────
# FEATURE FLAGS
# ─────────────────────────────────────────────────────────────────────────────────

variable "enable_waf" {
  description = "Enable AWS WAF for ALB"
  type        = bool
  default     = false  # Enable after initial deployment
}

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = false  # Enable for static assets
}

variable "enable_xray" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = false  # Enable for production debugging
}

variable "enable_read_replica" {
  description = "Enable RDS read replica for analytics"
  type        = bool
  default     = false  # Enable when needed
}
