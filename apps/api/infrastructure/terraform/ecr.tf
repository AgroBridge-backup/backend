# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - ELASTIC CONTAINER REGISTRY (ECR)
# ═══════════════════════════════════════════════════════════════════════════════
# Private Docker registry for container images with:
# - Automatic vulnerability scanning
# - Lifecycle policies to manage costs
# - Encryption at rest
# - Cross-account/GitHub Actions access
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# ECR REPOSITORY - BACKEND API
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "backend" {
  name                 = "${var.app_name}-backend"
  image_tag_mutability = "MUTABLE"  # Allow tag overwriting (for :latest, :staging)

  # ─────────────────────────────────────────────────────────────────────────────
  # ENCRYPTION
  # ─────────────────────────────────────────────────────────────────────────────
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.ecr.arn
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # IMAGE SCANNING
  # ─────────────────────────────────────────────────────────────────────────────
  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.app_name}-backend"
    Application = "AgroBridge API"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECR REPOSITORY - WORKER (for background jobs if separate container)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "worker" {
  name                 = "${var.app_name}-worker"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.ecr.arn
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.app_name}-worker"
    Application = "AgroBridge Worker"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# LIFECYCLE POLICY - BACKEND
# ─────────────────────────────────────────────────────────────────────────────────
# Manages image retention to control storage costs

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        # Rule 1: Keep last 10 production images (tagged with semver or 'production')
        rulePriority = 1
        description  = "Keep last 10 production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "production", "release"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        # Rule 2: Keep last 5 staging images
        rulePriority = 2
        description  = "Keep last 5 staging images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["staging", "develop"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = {
          type = "expire"
        }
      },
      {
        # Rule 3: Keep last 3 images tagged with git SHA
        rulePriority = 3
        description  = "Keep last 3 SHA-tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = 3
        }
        action = {
          type = "expire"
        }
      },
      {
        # Rule 4: Delete untagged images after 1 day
        rulePriority = 4
        description  = "Delete untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        # Rule 5: Catch-all - delete any image older than 30 days
        rulePriority = 5
        description  = "Delete images older than 30 days"
        selection = {
          tagStatus   = "any"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# LIFECYCLE POLICY - WORKER
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "production"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Delete images older than 14 days"
        selection = {
          tagStatus   = "any"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# REPOSITORY POLICY - BACKEND
# ─────────────────────────────────────────────────────────────────────────────────
# Allows ECS tasks and GitHub Actions to pull images

resource "aws_ecr_repository_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPullFromECS"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task_execution.arn
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      },
      {
        Sid    = "AllowPushFromGitHubActions"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.github_actions.arn
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# REPOSITORY POLICY - WORKER
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository_policy" "worker" {
  repository = aws_ecr_repository.worker.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPullFromECS"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task_execution.arn
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      },
      {
        Sid    = "AllowPushFromGitHubActions"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.github_actions.arn
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECR PULL-THROUGH CACHE (Optional - for base images)
# ─────────────────────────────────────────────────────────────────────────────────
# Caches Docker Hub images to reduce pull rate limits and improve speed

resource "aws_ecr_pull_through_cache_rule" "dockerhub" {
  ecr_repository_prefix = "dockerhub"
  upstream_registry_url = "registry-1.docker.io"

  # Note: Requires Docker Hub credentials stored in Secrets Manager
  # for private images or to avoid rate limiting
}

resource "aws_ecr_pull_through_cache_rule" "ecr_public" {
  ecr_repository_prefix = "ecr-public"
  upstream_registry_url = "public.ecr.aws"
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECR REGISTRY SCANNING CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────
# Enhanced scanning with Amazon Inspector (production only)

resource "aws_ecr_registry_scanning_configuration" "main" {
  scan_type = local.is_production ? "ENHANCED" : "BASIC"

  dynamic "rule" {
    for_each = local.is_production ? [1] : []
    content {
      scan_frequency = "CONTINUOUS_SCAN"
      repository_filter {
        filter      = "*"
        filter_type = "WILDCARD"
      }
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# KMS KEY FOR ECR ENCRYPTION
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_kms_key" "ecr" {
  description             = "KMS key for ECR encryption - ${var.app_name}"
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
        Sid    = "Allow ECR Service"
        Effect = "Allow"
        Principal = {
          Service = "ecr.amazonaws.com"
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
    Name = "${local.name_prefix}-ecr-key"
  }
}

resource "aws_kms_alias" "ecr" {
  name          = "alias/${local.name_prefix}-ecr"
  target_key_id = aws_kms_key.ecr.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH EVENT FOR SCAN FINDINGS (Production)
# ─────────────────────────────────────────────────────────────────────────────────
# Alert when critical/high vulnerabilities are found

resource "aws_cloudwatch_event_rule" "ecr_scan_findings" {
  count = local.is_production ? 1 : 0

  name        = "${local.name_prefix}-ecr-scan-findings"
  description = "Alert on ECR image scan findings"

  event_pattern = jsonencode({
    source      = ["aws.ecr"]
    detail-type = ["ECR Image Scan"]
    detail = {
      scan-status = ["COMPLETE"]
      finding-severity-counts = {
        CRITICAL = [{ "numeric" : [">", 0] }]
      }
    }
  })

  tags = {
    Name = "${local.name_prefix}-ecr-scan-findings"
  }
}

resource "aws_cloudwatch_event_target" "ecr_scan_findings_sns" {
  count = local.is_production ? 1 : 0

  rule      = aws_cloudwatch_event_rule.ecr_scan_findings[0].name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.alerts[0].arn

  input_transformer {
    input_paths = {
      repository = "$.detail.repository-name"
      tag        = "$.detail.image-tags[0]"
      critical   = "$.detail.finding-severity-counts.CRITICAL"
      high       = "$.detail.finding-severity-counts.HIGH"
    }
    input_template = "\"CRITICAL: ECR scan found vulnerabilities in <repository>:<tag>. Critical: <critical>, High: <high>. Review immediately!\""
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECR REPLICATION (Optional - for disaster recovery)
# ─────────────────────────────────────────────────────────────────────────────────
# Uncomment to replicate images to another region

# resource "aws_ecr_replication_configuration" "main" {
#   replication_configuration {
#     rule {
#       destination {
#         region      = "us-west-2"
#         registry_id = local.account_id
#       }
#       repository_filter {
#         filter      = "${var.app_name}-*"
#         filter_type = "PREFIX_MATCH"
#       }
#     }
#   }
# }

# ─────────────────────────────────────────────────────────────────────────────────
# DOCKER BUILD & PUSH COMMANDS (for reference)
# ─────────────────────────────────────────────────────────────────────────────────
#
# Login to ECR:
#   aws ecr get-login-password --region us-east-1 | \
#     docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
#
# Build image:
#   docker build -t agrobridge-backend:latest -f Dockerfile.production .
#
# Tag for ECR:
#   docker tag agrobridge-backend:latest \
#     ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/agrobridge-backend:latest
#   docker tag agrobridge-backend:latest \
#     ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/agrobridge-backend:v1.0.0
#   docker tag agrobridge-backend:latest \
#     ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/agrobridge-backend:sha-${GIT_SHA:0:7}
#
# Push to ECR:
#   docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/agrobridge-backend:latest
#   docker push ${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/agrobridge-backend:v1.0.0
#
# ─────────────────────────────────────────────────────────────────────────────────
