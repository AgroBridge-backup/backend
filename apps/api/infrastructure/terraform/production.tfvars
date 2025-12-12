# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - PRODUCTION ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
# Usage: terraform apply -var-file="production.tfvars"
# Or: terraform workspace select production && terraform apply
# ═══════════════════════════════════════════════════════════════════════════════

# Core
environment = "production"
aws_region  = "us-east-1"
app_name    = "agrobridge"
domain_name = "api.agrobridge.io"

# Networking - Full HA: NAT Gateway per AZ
single_nat_gateway = false

# ECS - Production resources applied via map lookups

# Monitoring - Production alerts
alarm_email = "alerts@agrobridge.io"
alarm_phone = "+521234567890"  # Update with real number

# Feature flags - Enable for production
enable_waf        = true   # Enable after initial deployment
enable_cloudfront = false  # Enable when needed for static assets
enable_xray       = true   # Enable for production tracing

# ═══════════════════════════════════════════════════════════════════════════════
# ESTIMATED MONTHLY COST (PRODUCTION): ~$850-1,200 USD
# ═══════════════════════════════════════════════════════════════════════════════
# - ECS Fargate (2-10 tasks, 2 vCPU, 4GB): ~$150-500
# - RDS db.r6g.xlarge (Multi-AZ):          ~$350
# - ElastiCache cache.r6g.large (2 nodes): ~$180
# - NAT Gateways (3x):                     ~$135
# - ALB:                                   ~$25
# - CloudWatch Logs + Insights:            ~$30
# - Secrets Manager:                       ~$10
# - S3 + Data Transfer:                    ~$30
# - WAF (optional):                        ~$25
# ═══════════════════════════════════════════════════════════════════════════════
#
# SCALING COSTS:
# - Each additional ECS task adds ~$50/month
# - Data transfer scales with usage
# - RDS storage auto-scales up to 500GB
# ═══════════════════════════════════════════════════════════════════════════════
