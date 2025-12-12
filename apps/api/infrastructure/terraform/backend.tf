# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - TERRAFORM BACKEND CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
# Remote state storage using S3 with DynamoDB locking
# This enables team collaboration and prevents concurrent modifications
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  # ─────────────────────────────────────────────────────────────────────────────
  # TERRAFORM VERSION CONSTRAINTS
  # ─────────────────────────────────────────────────────────────────────────────
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # S3 BACKEND CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  # Prerequisites (already created):
  # - S3 bucket: agrobridge-terraform-state
  # - DynamoDB table: agrobridge-terraform-locks
  # ─────────────────────────────────────────────────────────────────────────────
  backend "s3" {
    bucket = "agrobridge-terraform-state"
    key    = "agrobridge/terraform.tfstate"
    region = "us-east-1"

    # DynamoDB table for state locking
    # Prevents concurrent terraform apply operations
    dynamodb_table = "agrobridge-terraform-locks"

    # Enable encryption at rest using S3-managed keys
    encrypt = true

    # Workspace-specific state files
    # staging:    agrobridge/env:/staging/terraform.tfstate
    # production: agrobridge/env:/production/terraform.tfstate
    workspace_key_prefix = "env"
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# AWS PROVIDER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

provider "aws" {
  region = var.aws_region

  # ─────────────────────────────────────────────────────────────────────────────
  # DEFAULT TAGS
  # Applied to ALL resources created by this Terraform configuration
  # ─────────────────────────────────────────────────────────────────────────────
  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Platform-Team"
      CostCenter  = "Engineering"
      Application = "AgroBridge-Backend"
      Repository  = "github.com/agrobridge/backend"
    }
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# ADDITIONAL PROVIDER FOR ACM CERTIFICATES (us-east-1 for CloudFront)
# ═══════════════════════════════════════════════════════════════════════════════

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "Platform-Team"
      CostCenter  = "Engineering"
      Application = "AgroBridge-Backend"
      Repository  = "github.com/agrobridge/backend"
    }
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# DATA SOURCES - ACCOUNT & REGION INFO
# ═══════════════════════════════════════════════════════════════════════════════

# Current AWS account information
data "aws_caller_identity" "current" {}

# Current AWS region
data "aws_region" "current" {}

# Available AZs in the region
data "aws_availability_zones" "available" {
  state = "available"

  # Exclude local zones and wavelength zones
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL VALUES - COMPUTED CONFIGURATIONS
# ═══════════════════════════════════════════════════════════════════════════════

locals {
  # AWS Account ID for use in IAM policies and ARNs
  account_id = data.aws_caller_identity.current.account_id

  # Region for resource ARNs
  region = data.aws_region.current.name

  # Select first 3 AZs for multi-AZ deployment
  azs = slice(data.aws_availability_zones.available.names, 0, 3)

  # Common naming prefix for all resources
  name_prefix = "${var.app_name}-${var.environment}"

  # Common tags (in addition to default_tags)
  common_tags = {
    CreatedAt = timestamp()
  }

  # Environment-specific configurations
  is_production = var.environment == "production"

  # Database connection string template
  # Actual values will come from Secrets Manager
  database_url_template = "postgresql://%s:%s@%s:5432/%s?schema=public&connection_limit=10"

  # Redis connection string template
  redis_url_template = "rediss://:%s@%s:6379"
}
