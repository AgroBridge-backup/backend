# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - ECS FARGATE CLUSTER & SERVICES
# ═══════════════════════════════════════════════════════════════════════════════
# Serverless container orchestration with:
# - Fargate launch type (no EC2 management)
# - Container Insights for monitoring
# - Auto-scaling based on CPU/Memory
# - Rolling deployments with circuit breaker
# - Secrets injection from Secrets Manager
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# ECS CLUSTER
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  # ─────────────────────────────────────────────────────────────────────────────
  # CONTAINER INSIGHTS
  # ─────────────────────────────────────────────────────────────────────────────
  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # EXECUTE COMMAND CONFIGURATION (for debugging)
  # ─────────────────────────────────────────────────────────────────────────────
  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.ecs.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
        cloud_watch_encryption_enabled = true
      }
    }
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

# Cluster capacity providers (Fargate + Fargate Spot)
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = local.is_production ? 80 : 0
    base              = local.is_production ? 1 : 0
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = local.is_production ? 20 : 100  # Staging uses spot for cost savings
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH LOG GROUPS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${local.name_prefix}"
  retention_in_days = var.log_retention_days[var.environment]
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "${local.name_prefix}-ecs-logs"
  }
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${local.name_prefix}/exec"
  retention_in_days = 7  # Short retention for exec logs
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "${local.name_prefix}-ecs-exec-logs"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# TASK DEFINITION - BACKEND API
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_cpu[var.environment]
  memory                   = var.ecs_memory[var.environment]
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  # ─────────────────────────────────────────────────────────────────────────────
  # CONTAINER DEFINITIONS
  # ─────────────────────────────────────────────────────────────────────────────
  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      # ───────────────────────────────────────────────────────────────────────
      # PORT MAPPINGS
      # ───────────────────────────────────────────────────────────────────────
      portMappings = [
        {
          name          = "http"
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      # ───────────────────────────────────────────────────────────────────────
      # ENVIRONMENT VARIABLES (non-sensitive)
      # ───────────────────────────────────────────────────────────────────────
      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "production" ? "production" : "staging"
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "LOG_LEVEL"
          value = var.environment == "production" ? "info" : "debug"
        },
        {
          name  = "CORS_ORIGIN"
          value = var.environment == "production" ? "https://app.agrobridge.io,https://www.agrobridge.io" : "*"
        },
        {
          name  = "API_VERSION"
          value = "v1"
        },
        {
          name  = "RATE_LIMIT_WINDOW_MS"
          value = "900000"  # 15 minutes
        },
        {
          name  = "RATE_LIMIT_MAX_REQUESTS"
          value = var.environment == "production" ? "100" : "1000"
        }
      ]

      # ───────────────────────────────────────────────────────────────────────
      # SECRETS (from Secrets Manager)
      # ───────────────────────────────────────────────────────────────────────
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:DATABASE_URL::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${aws_secretsmanager_secret.redis_credentials.arn}:REDIS_URL::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        },
        {
          name      = "JWT_REFRESH_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_refresh_secret.arn
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.stripe_secret.arn
        },
        {
          name      = "STRIPE_WEBHOOK_SECRET"
          valueFrom = aws_secretsmanager_secret.stripe_webhook_secret.arn
        },
        {
          name      = "SENDGRID_API_KEY"
          valueFrom = aws_secretsmanager_secret.sendgrid_api_key.arn
        },
        {
          name      = "TWILIO_ACCOUNT_SID"
          valueFrom = "${aws_secretsmanager_secret.twilio_credentials.arn}:TWILIO_ACCOUNT_SID::"
        },
        {
          name      = "TWILIO_AUTH_TOKEN"
          valueFrom = "${aws_secretsmanager_secret.twilio_credentials.arn}:TWILIO_AUTH_TOKEN::"
        },
        {
          name      = "TWILIO_PHONE_NUMBER"
          valueFrom = "${aws_secretsmanager_secret.twilio_credentials.arn}:TWILIO_PHONE_NUMBER::"
        },
        {
          name      = "FIREBASE_PROJECT_ID"
          valueFrom = "${aws_secretsmanager_secret.firebase_credentials.arn}:project_id::"
        },
        {
          name      = "FIREBASE_PRIVATE_KEY"
          valueFrom = "${aws_secretsmanager_secret.firebase_credentials.arn}:private_key::"
        },
        {
          name      = "FIREBASE_CLIENT_EMAIL"
          valueFrom = "${aws_secretsmanager_secret.firebase_credentials.arn}:client_email::"
        }
      ]

      # ───────────────────────────────────────────────────────────────────────
      # HEALTH CHECK
      # ───────────────────────────────────────────────────────────────────────
      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"const http = require('http'); const options = { hostname: 'localhost', port: ${var.container_port}, path: '/api/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();\" || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      # ───────────────────────────────────────────────────────────────────────
      # LOGGING
      # ───────────────────────────────────────────────────────────────────────
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }

      # ───────────────────────────────────────────────────────────────────────
      # RESOURCE LIMITS
      # ───────────────────────────────────────────────────────────────────────
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]

      # ───────────────────────────────────────────────────────────────────────
      # LINUX PARAMETERS
      # ───────────────────────────────────────────────────────────────────────
      linuxParameters = {
        initProcessEnabled = true  # Proper signal handling for graceful shutdown
      }

      # ───────────────────────────────────────────────────────────────────────
      # STOP TIMEOUT
      # ───────────────────────────────────────────────────────────────────────
      stopTimeout = 30  # Seconds to wait before force killing
    }
  ])

  # ─────────────────────────────────────────────────────────────────────────────
  # RUNTIME PLATFORM
  # ─────────────────────────────────────────────────────────────────────────────
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"  # Change to ARM64 for Graviton (cost savings)
  }

  tags = {
    Name = "${local.name_prefix}-backend-task"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECS SERVICE - BACKEND API
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_desired_count[var.environment]
  launch_type     = "FARGATE"
  platform_version = "LATEST"

  # ─────────────────────────────────────────────────────────────────────────────
  # NETWORK CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # LOAD BALANCER
  # ─────────────────────────────────────────────────────────────────────────────
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # DEPLOYMENT CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  health_check_grace_period_seconds  = var.health_check_grace_period

  # Circuit breaker for automatic rollback
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # SERVICE DISCOVERY (Optional - for internal service-to-service communication)
  # ─────────────────────────────────────────────────────────────────────────────
  # service_registries {
  #   registry_arn = aws_service_discovery_service.backend.arn
  # }

  # ─────────────────────────────────────────────────────────────────────────────
  # ENABLE EXECUTE COMMAND (for debugging)
  # ─────────────────────────────────────────────────────────────────────────────
  enable_execute_command = true

  # ─────────────────────────────────────────────────────────────────────────────
  # PROPAGATE TAGS
  # ─────────────────────────────────────────────────────────────────────────────
  propagate_tags = "SERVICE"

  tags = {
    Name = "${local.name_prefix}-backend-service"
  }

  # Wait for ALB listener before creating service
  depends_on = [
    aws_lb_listener.https,
    aws_lb_listener.http
  ]

  lifecycle {
    ignore_changes = [
      desired_count,  # Managed by auto-scaling
      task_definition # Managed by CI/CD deployments
    ]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# AUTO-SCALING - APPLICATION AUTO SCALING TARGET
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = var.ecs_max_capacity[var.environment]
  min_capacity       = var.ecs_min_capacity[var.environment]
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# ─────────────────────────────────────────────────────────────────────────────────
# AUTO-SCALING POLICY - CPU
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "${local.name_prefix}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# AUTO-SCALING POLICY - MEMORY
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_appautoscaling_policy" "ecs_memory" {
  name               = "${local.name_prefix}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.memory_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# AUTO-SCALING POLICY - REQUEST COUNT (ALB)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_appautoscaling_policy" "ecs_requests" {
  name               = "${local.name_prefix}-request-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.backend.arn_suffix}"
    }
    target_value       = 1000  # Requests per target per minute
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# SCHEDULED SCALING (Optional - for predictable traffic patterns)
# ─────────────────────────────────────────────────────────────────────────────────
# Scale up during business hours (Mexico time: UTC-6)

resource "aws_appautoscaling_scheduled_action" "scale_up" {
  count = local.is_production ? 1 : 0

  name               = "${local.name_prefix}-scale-up-business-hours"
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  schedule           = "cron(0 14 ? * MON-FRI *)"  # 8 AM Mexico time

  scalable_target_action {
    min_capacity = 3
    max_capacity = 10
  }
}

resource "aws_appautoscaling_scheduled_action" "scale_down" {
  count = local.is_production ? 1 : 0

  name               = "${local.name_prefix}-scale-down-night"
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  schedule           = "cron(0 4 ? * * *)"  # 10 PM Mexico time

  scalable_target_action {
    min_capacity = 2
    max_capacity = 5
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# KMS KEY FOR ECS EXEC
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_kms_key" "ecs" {
  description             = "KMS key for ECS exec encryption - ${var.app_name}"
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
        Sid    = "Allow ECS Service"
        Effect = "Allow"
        Principal = {
          Service = "ecs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-key"
  }
}

resource "aws_kms_alias" "ecs" {
  name          = "alias/${local.name_prefix}-ecs"
  target_key_id = aws_kms_key.ecs.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH ALARMS FOR ECS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = var.alarm_cpu_threshold
  alarm_description   = "ECS CPU utilization is above ${var.alarm_cpu_threshold}%"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = {
    Name = "${local.name_prefix}-ecs-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = var.alarm_memory_threshold
  alarm_description   = "ECS memory utilization is above ${var.alarm_memory_threshold}%"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = {
    Name = "${local.name_prefix}-ecs-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-ecs-no-running-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "No running ECS tasks - service is down!"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = {
    Name = "${local.name_prefix}-ecs-running-tasks-alarm"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECS EXEC DEBUGGING COMMANDS (Reference)
# ─────────────────────────────────────────────────────────────────────────────────
#
# Get task ID:
#   TASK_ID=$(aws ecs list-tasks --cluster agrobridge-production-cluster \
#     --service-name agrobridge-production-backend --query 'taskArns[0]' --output text)
#
# Connect to container:
#   aws ecs execute-command --cluster agrobridge-production-cluster \
#     --task $TASK_ID --container backend --interactive \
#     --command "/bin/sh"
#
# Run one-off command:
#   aws ecs execute-command --cluster agrobridge-production-cluster \
#     --task $TASK_ID --container backend --interactive \
#     --command "node -e \"console.log(process.env.NODE_ENV)\""
#
# ─────────────────────────────────────────────────────────────────────────────────
