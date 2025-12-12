# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - STAGING ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
# Usage: terraform apply -var-file="staging.tfvars"
# Or: terraform workspace select staging && terraform apply
# ═══════════════════════════════════════════════════════════════════════════════

# Core
environment = "staging"
aws_region  = "us-east-1"
app_name    = "agrobridge"
domain_name = "api-staging.agrobridge.io"

# Networking - Cost optimization: single NAT Gateway
single_nat_gateway = true

# ECS - Minimal resources for staging
# Overrides are applied via the map lookups in the module

# Monitoring
alarm_email = "alerts-staging@agrobridge.io"

# Feature flags - Minimal for staging
enable_waf        = false
enable_cloudfront = false
enable_xray       = false

# ═══════════════════════════════════════════════════════════════════════════════
# ESTIMATED MONTHLY COST (STAGING): ~$180-220 USD
# ═══════════════════════════════════════════════════════════════════════════════
# - ECS Fargate (1 task, 1 vCPU, 2GB):     ~$35
# - RDS db.t3.medium (single-AZ):          ~$50
# - ElastiCache cache.t3.micro:            ~$12
# - NAT Gateway (1x):                      ~$45
# - ALB:                                   ~$25
# - CloudWatch Logs:                       ~$10
# - Secrets Manager:                       ~$5
# - S3 + Data Transfer:                    ~$10
# ═══════════════════════════════════════════════════════════════════════════════
