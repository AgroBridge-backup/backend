# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - IAM ROLES & POLICIES
# ═══════════════════════════════════════════════════════════════════════════════
# Least privilege IAM configuration for:
# - ECS Task Execution Role (pull images, get secrets)
# - ECS Task Role (application permissions)
# - GitHub Actions Role (CI/CD deployments via OIDC)
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# ECS TASK EXECUTION ROLE
# ─────────────────────────────────────────────────────────────────────────────────
# Used by ECS agent to:
# - Pull container images from ECR
# - Retrieve secrets from Secrets Manager
# - Write logs to CloudWatch

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task-execution-role"
  }
}

# Attach AWS managed policy for basic ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${local.name_prefix}-ecs-secrets-policy"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${local.account_id}:secret:${local.name_prefix}/*"
        ]
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.secrets.arn
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECS TASK ROLE
# ─────────────────────────────────────────────────────────────────────────────────
# Used by the application container to:
# - Access S3 buckets
# - Send emails via SES
# - Publish to SNS
# - Access other AWS services

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task-role"
  }
}

# S3 Access Policy
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-s3-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3ProductImages"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_product_images_bucket}-${var.environment}-${local.account_id}",
          "arn:aws:s3:::${var.s3_product_images_bucket}-${var.environment}-${local.account_id}/*"
        ]
      },
      {
        Sid    = "S3UserDocuments"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_user_documents_bucket}-${var.environment}-${local.account_id}",
          "arn:aws:s3:::${var.s3_user_documents_bucket}-${var.environment}-${local.account_id}/*"
        ]
      },
      {
        Sid    = "S3KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.s3.arn
        ]
      }
    ]
  })
}

# SES Email Sending Policy
resource "aws_iam_role_policy" "ecs_task_ses" {
  name = "${local.name_prefix}-ecs-ses-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendEmail"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = [
              "noreply@agrobridge.io",
              "notifications@agrobridge.io",
              "support@agrobridge.io"
            ]
          }
        }
      }
    ]
  })
}

# SNS Publish Policy
resource "aws_iam_role_policy" "ecs_task_sns" {
  name = "${local.name_prefix}-ecs-sns-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PublishToSNS"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          "arn:aws:sns:${var.aws_region}:${local.account_id}:${local.name_prefix}-*"
        ]
      }
    ]
  })
}

# CloudWatch Metrics Policy (custom metrics from application)
resource "aws_iam_role_policy" "ecs_task_cloudwatch" {
  name = "${local.name_prefix}-ecs-cloudwatch-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PutMetrics"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "${var.app_name}/*"
          }
        }
      }
    ]
  })
}

# X-Ray Tracing Policy (optional)
resource "aws_iam_role_policy" "ecs_task_xray" {
  count = var.enable_xray ? 1 : 0

  name = "${local.name_prefix}-ecs-xray-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "XRayTracing"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECS Exec Policy (for debugging)
resource "aws_iam_role_policy" "ecs_task_exec" {
  name = "${local.name_prefix}-ecs-exec-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECSExec"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSExecLogs"
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSExecKMS"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.ecs.arn
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# GITHUB ACTIONS OIDC PROVIDER
# ─────────────────────────────────────────────────────────────────────────────────
# Enables GitHub Actions to assume AWS roles without long-lived credentials

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  tags = {
    Name = "${local.name_prefix}-github-oidc"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# GITHUB ACTIONS ROLE
# ─────────────────────────────────────────────────────────────────────────────────
# Used by GitHub Actions for CI/CD deployments

resource "aws_iam_role" "github_actions" {
  name = "${local.name_prefix}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-github-actions-role"
  }
}

# ECR Push/Pull Policy for GitHub Actions
resource "aws_iam_role_policy" "github_actions_ecr" {
  name = "${local.name_prefix}-github-ecr-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRPushPull"
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:ListImages"
        ]
        Resource = [
          aws_ecr_repository.backend.arn,
          aws_ecr_repository.worker.arn
        ]
      }
    ]
  })
}

# ECS Deployment Policy for GitHub Actions
resource "aws_iam_role_policy" "github_actions_ecs" {
  name = "${local.name_prefix}-github-ecs-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECSUpdateService"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:ListTasks",
          "ecs:DescribeTasks"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ecs:cluster" = aws_ecs_cluster.main.arn
          }
        }
      },
      {
        Sid    = "ECSRegisterTaskDefinition"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:DeregisterTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Sid    = "PassRole"
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
      }
    ]
  })
}

# CloudWatch Logs Policy for GitHub Actions (view deployment logs)
resource "aws_iam_role_policy" "github_actions_logs" {
  name = "${local.name_prefix}-github-logs-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ViewLogs"
        Effect = "Allow"
        Action = [
          "logs:GetLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.ecs.arn}:*"
        ]
      }
    ]
  })
}

# Secrets Manager Read Policy for GitHub Actions (get current secret values for task def)
resource "aws_iam_role_policy" "github_actions_secrets" {
  name = "${local.name_prefix}-github-secrets-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ListSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:ListSecrets"
        ]
        Resource = "*"
      },
      {
        Sid    = "DescribeSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${local.account_id}:secret:${local.name_prefix}/*"
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# SERVICE-LINKED ROLES (Created automatically, documented here)
# ─────────────────────────────────────────────────────────────────────────────────
#
# The following service-linked roles are created automatically by AWS:
#
# 1. AWSServiceRoleForECS
#    - Created when you first use ECS
#    - Used by ECS to manage resources on your behalf
#
# 2. AWSServiceRoleForElasticLoadBalancing
#    - Created when you first use ELB
#    - Used by ALB to manage ENIs, security groups
#
# 3. AWSServiceRoleForRDS
#    - Created when you first use RDS
#    - Used by RDS for Enhanced Monitoring, etc.
#
# 4. AWSServiceRoleForElastiCache
#    - Created when you first use ElastiCache
#    - Used for VPC networking
#
# 5. AWSServiceRoleForApplicationAutoScaling_ECSService
#    - Created when you first use ECS auto-scaling
#    - Used to scale ECS services
#
# ─────────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────────
# IAM POLICY SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# ECS Task Execution Role:
#   - AmazonECSTaskExecutionRolePolicy (managed)
#   - Secrets Manager: GetSecretValue
#   - KMS: Decrypt (secrets key)
#
# ECS Task Role:
#   - S3: GetObject, PutObject, DeleteObject, ListBucket
#   - SES: SendEmail, SendRawEmail, SendTemplatedEmail
#   - SNS: Publish
#   - CloudWatch: PutMetricData
#   - X-Ray: PutTraceSegments (optional)
#   - SSM Messages: ECS Exec support
#
# GitHub Actions Role (OIDC):
#   - ECR: Push, Pull, Describe images
#   - ECS: UpdateService, RegisterTaskDefinition
#   - IAM: PassRole (for ECS roles)
#   - CloudWatch Logs: GetLogEvents
#   - Secrets Manager: ListSecrets, DescribeSecret
#
# ─────────────────────────────────────────────────────────────────────────────────
