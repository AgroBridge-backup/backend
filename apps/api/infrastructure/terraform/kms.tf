# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - KMS ENCRYPTION KEYS
# ═══════════════════════════════════════════════════════════════════════════════
# Centralized KMS key management for all encrypted resources
# Keys defined here are used across the infrastructure for:
# - RDS encryption at rest
# - ElastiCache encryption
# - CloudWatch Logs encryption
# - S3 bucket encryption
# - SNS topic encryption
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# RDS ENCRYPTION KEY
# ─────────────────────────────────────────────────────────────────────────────────
# Used for PostgreSQL database encryption at rest

resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption - ${var.app_name}"
  deletion_window_in_days = local.is_production ? 30 : 7
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS Service"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = local.account_id
            "kms:ViaService"    = "rds.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-rds-key"
    Service = "RDS"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# ELASTICACHE (REDIS) ENCRYPTION KEY
# ─────────────────────────────────────────────────────────────────────────────────
# Used for Redis encryption at rest

resource "aws_kms_key" "redis" {
  description             = "KMS key for ElastiCache Redis encryption - ${var.app_name}"
  deletion_window_in_days = local.is_production ? 30 : 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ElastiCache Service"
        Effect = "Allow"
        Principal = {
          Service = "elasticache.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-redis-key"
    Service = "ElastiCache"
  }
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${local.name_prefix}-redis"
  target_key_id = aws_kms_key.redis.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH LOGS ENCRYPTION KEY
# ─────────────────────────────────────────────────────────────────────────────────
# Used for encrypting CloudWatch log groups

resource "aws_kms_key" "cloudwatch" {
  description             = "KMS key for CloudWatch Logs encryption - ${var.app_name}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-cloudwatch-key"
    Service = "CloudWatch"
  }
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/${local.name_prefix}-cloudwatch"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# S3 ENCRYPTION KEY
# ─────────────────────────────────────────────────────────────────────────────────
# Used for S3 bucket encryption (user documents, sensitive data)

resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 encryption - ${var.app_name}"
  deletion_window_in_days = local.is_production ? 30 : 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 Service"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow ECS Task Role for S3 Operations"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-s3-key"
    Service = "S3"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.name_prefix}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# SNS ENCRYPTION KEY
# ─────────────────────────────────────────────────────────────────────────────────
# Used for SNS topic encryption (alerts, notifications)

resource "aws_kms_key" "sns" {
  description             = "KMS key for SNS encryption - ${var.app_name}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow SNS Service"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Alarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow EventBridge"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-sns-key"
    Service = "SNS"
  }
}

resource "aws_kms_alias" "sns" {
  name          = "alias/${local.name_prefix}-sns"
  target_key_id = aws_kms_key.sns.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# SQS ENCRYPTION KEY (Future - for message queues)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_kms_key" "sqs" {
  description             = "KMS key for SQS encryption - ${var.app_name}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow SQS Service"
        Effect = "Allow"
        Principal = {
          Service = "sqs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow SNS to SQS"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-sqs-key"
    Service = "SQS"
  }
}

resource "aws_kms_alias" "sqs" {
  name          = "alias/${local.name_prefix}-sqs"
  target_key_id = aws_kms_key.sqs.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# GENERAL PURPOSE ENCRYPTION KEY
# ─────────────────────────────────────────────────────────────────────────────────
# For application-level encryption needs

resource "aws_kms_key" "general" {
  description             = "General purpose KMS key - ${var.app_name}"
  deletion_window_in_days = local.is_production ? 30 : 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS Tasks"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.ecs_task.arn,
            aws_iam_role.ecs_task_execution.arn
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name    = "${local.name_prefix}-general-key"
    Service = "General"
  }
}

resource "aws_kms_alias" "general" {
  name          = "alias/${local.name_prefix}-general"
  target_key_id = aws_kms_key.general.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# KMS KEY SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# Keys Created (8 total):
# ┌──────────────────────────────────────────────────────────────────────────────┐
# │  Alias                              │  Service       │  Rotation  │  Delete  │
# ├──────────────────────────────────────────────────────────────────────────────┤
# │  alias/{env}-secrets                │  Secrets Mgr   │  Yes       │  7 days  │
# │  alias/{env}-ecr                    │  ECR           │  Yes       │  7 days  │
# │  alias/{env}-ecs                    │  ECS Exec      │  Yes       │  7 days  │
# │  alias/{env}-rds                    │  RDS           │  Yes       │  30 days │
# │  alias/{env}-redis                  │  ElastiCache   │  Yes       │  30 days │
# │  alias/{env}-cloudwatch             │  CloudWatch    │  Yes       │  7 days  │
# │  alias/{env}-s3                     │  S3            │  Yes       │  30 days │
# │  alias/{env}-sns                    │  SNS           │  Yes       │  7 days  │
# │  alias/{env}-sqs                    │  SQS           │  Yes       │  7 days  │
# │  alias/{env}-general                │  General       │  Yes       │  30 days │
# └──────────────────────────────────────────────────────────────────────────────┘
#
# Note: Keys in secrets.tf (secrets), ecr.tf (ecr), ecs.tf (ecs) are defined there
# for better code organization with their respective resources.
#
# ─────────────────────────────────────────────────────────────────────────────────
