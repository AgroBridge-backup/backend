# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - CLOUDWATCH MONITORING & ALERTING
# ═══════════════════════════════════════════════════════════════════════════════
# Comprehensive monitoring setup with:
# - SNS topics for alerts
# - CloudWatch Dashboard for visualization
# - Log metric filters for error tracking
# - Composite alarms for critical issues
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# SNS TOPICS FOR ALERTS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  count = local.is_production || var.alarm_email != "" ? 1 : 0

  name              = "${local.name_prefix}-alerts"
  kms_master_key_id = aws_kms_key.sns.id

  tags = {
    Name = "${local.name_prefix}-alerts"
  }
}

resource "aws_sns_topic" "critical_alerts" {
  count = local.is_production ? 1 : 0

  name              = "${local.name_prefix}-critical-alerts"
  kms_master_key_id = aws_kms_key.sns.id

  tags = {
    Name     = "${local.name_prefix}-critical-alerts"
    Priority = "Critical"
  }
}

# Email subscription for alerts
resource "aws_sns_topic_subscription" "alerts_email" {
  count = var.alarm_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# Email subscription for critical alerts
resource "aws_sns_topic_subscription" "critical_alerts_email" {
  count = local.is_production && var.alarm_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# SMS subscription for critical alerts (optional)
resource "aws_sns_topic_subscription" "critical_alerts_sms" {
  count = local.is_production && var.alarm_phone != "" ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts[0].arn
  protocol  = "sms"
  endpoint  = var.alarm_phone
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # ─────────────────────────────────────────────────────────────────────────
      # ROW 1: ECS SERVICE METRICS
      # ─────────────────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "ECS CPU Utilization"
          region = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.backend.name, { stat = "Average", period = 60 }]
          ]
          yAxis = {
            left = { min = 0, max = 100 }
          }
          annotations = {
            horizontal = [
              { value = var.cpu_target_value, label = "Scale Threshold" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "ECS Memory Utilization"
          region = var.aws_region
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.backend.name, { stat = "Average", period = 60 }]
          ]
          yAxis = {
            left = { min = 0, max = 100 }
          }
          annotations = {
            horizontal = [
              { value = var.memory_target_value, label = "Scale Threshold" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "ECS Running Tasks"
          region = var.aws_region
          metrics = [
            ["ECS/ContainerInsights", "RunningTaskCount", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.backend.name, { stat = "Average", period = 60 }],
            ["ECS/ContainerInsights", "DesiredTaskCount", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.backend.name, { stat = "Average", period = 60 }]
          ]
        }
      },

      # ─────────────────────────────────────────────────────────────────────────
      # ROW 2: ALB METRICS
      # ─────────────────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB Request Count"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB Response Time (p50, p95, p99)"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix, "TargetGroup", aws_lb_target_group.backend.arn_suffix, { stat = "p50", period = 60, label = "p50" }],
            ["...", { stat = "p95", period = 60, label = "p95" }],
            ["...", { stat = "p99", period = 60, label = "p99" }]
          ]
          yAxis = {
            left = { label = "Seconds" }
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB HTTP Errors"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", aws_lb.main.arn_suffix, "TargetGroup", aws_lb_target_group.backend.arn_suffix, { stat = "Sum", period = 60, label = "4xx", color = "#ff7f0e" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.main.arn_suffix, "TargetGroup", aws_lb_target_group.backend.arn_suffix, { stat = "Sum", period = 60, label = "5xx", color = "#d62728" }]
          ]
        }
      },

      # ─────────────────────────────────────────────────────────────────────────
      # ROW 3: RDS METRICS
      # ─────────────────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "RDS CPU Utilization"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.identifier, { stat = "Average", period = 60 }]
          ]
          yAxis = {
            left = { min = 0, max = 100 }
          }
          annotations = {
            horizontal = [
              { value = var.alarm_db_cpu_threshold, label = "Alarm Threshold" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "RDS Database Connections"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.main.identifier, { stat = "Average", period = 60 }]
          ]
          annotations = {
            horizontal = [
              { value = var.alarm_db_connections_threshold, label = "Alarm Threshold" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "RDS Free Storage (GB)"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.main.identifier, { stat = "Average", period = 300 }]
          ]
          yAxis = {
            left = { label = "Bytes" }
          }
        }
      },

      # ─────────────────────────────────────────────────────────────────────────
      # ROW 4: REDIS METRICS
      # ─────────────────────────────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 8
        height = 6
        properties = {
          title  = "Redis CPU Utilization"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${local.name_prefix}-redis-001", { stat = "Average", period = 60 }]
          ]
          yAxis = {
            left = { min = 0, max = 100 }
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 18
        width  = 8
        height = 6
        properties = {
          title  = "Redis Memory Usage %"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "CacheClusterId", "${local.name_prefix}-redis-001", { stat = "Average", period = 60 }]
          ]
          yAxis = {
            left = { min = 0, max = 100 }
          }
          annotations = {
            horizontal = [
              { value = var.alarm_redis_memory_threshold, label = "Alarm Threshold" }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 18
        width  = 8
        height = 6
        properties = {
          title  = "Redis Cache Hits/Misses"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "CacheHits", "CacheClusterId", "${local.name_prefix}-redis-001", { stat = "Sum", period = 60, label = "Hits", color = "#2ca02c" }],
            ["AWS/ElastiCache", "CacheMisses", "CacheClusterId", "${local.name_prefix}-redis-001", { stat = "Sum", period = 60, label = "Misses", color = "#d62728" }]
          ]
        }
      },

      # ─────────────────────────────────────────────────────────────────────────
      # ROW 5: APPLICATION LOGS
      # ─────────────────────────────────────────────────────────────────────────
      {
        type   = "log"
        x      = 0
        y      = 24
        width  = 24
        height = 6
        properties = {
          title  = "Application Errors (Last 1 hour)"
          region = var.aws_region
          query  = "SOURCE '${aws_cloudwatch_log_group.ecs.name}' | fields @timestamp, @message | filter @message like /error|Error|ERROR/ | sort @timestamp desc | limit 50"
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# LOG METRIC FILTERS
# ─────────────────────────────────────────────────────────────────────────────────
# Extract metrics from application logs

resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${local.name_prefix}-error-count"
  pattern        = "?ERROR ?Error ?error"
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "ErrorCount"
    namespace     = "${var.app_name}/Application"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "warning_count" {
  name           = "${local.name_prefix}-warning-count"
  pattern        = "?WARN ?Warning ?warning"
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "WarningCount"
    namespace     = "${var.app_name}/Application"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "auth_failures" {
  name           = "${local.name_prefix}-auth-failures"
  pattern        = "\"authentication failed\" OR \"invalid token\" OR \"unauthorized\""
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "AuthFailureCount"
    namespace     = "${var.app_name}/Security"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "payment_errors" {
  name           = "${local.name_prefix}-payment-errors"
  pattern        = "\"payment failed\" OR \"stripe error\" OR \"payment_intent.failed\""
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "PaymentErrorCount"
    namespace     = "${var.app_name}/Payments"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "database_errors" {
  name           = "${local.name_prefix}-database-errors"
  pattern        = "\"PrismaClientKnownRequestError\" OR \"database connection\" OR \"ECONNREFUSED\""
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name          = "DatabaseErrorCount"
    namespace     = "${var.app_name}/Database"
    value         = "1"
    default_value = "0"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ALARMS FOR APPLICATION METRICS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ErrorCount"
  namespace           = "${var.app_name}/Application"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "High error rate in application logs (>50 errors in 5 min)"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name = "${local.name_prefix}-error-rate-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "auth_failure_spike" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-auth-failure-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "AuthFailureCount"
  namespace           = "${var.app_name}/Security"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Possible brute force attack - high auth failures"
  alarm_actions       = [aws_sns_topic.critical_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name     = "${local.name_prefix}-auth-failure-alarm"
    Priority = "Critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "payment_errors" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-payment-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "PaymentErrorCount"
  namespace           = "${var.app_name}/Payments"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Payment processing errors detected"
  alarm_actions       = [aws_sns_topic.critical_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name     = "${local.name_prefix}-payment-errors-alarm"
    Priority = "Critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connection_errors" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-database-connection-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseErrorCount"
  namespace           = "${var.app_name}/Database"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Database connection errors detected"
  alarm_actions       = [aws_sns_topic.critical_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name     = "${local.name_prefix}-database-errors-alarm"
    Priority = "Critical"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# COMPOSITE ALARM - SERVICE DOWN
# ─────────────────────────────────────────────────────────────────────────────────
# Triggers when multiple critical conditions are met

resource "aws_cloudwatch_composite_alarm" "service_down" {
  count = local.is_production ? 1 : 0

  alarm_name        = "${local.name_prefix}-service-down"
  alarm_description = "CRITICAL: AgroBridge API service is down or severely degraded"

  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.ecs_running_tasks[0].alarm_name}) OR (ALARM(${aws_cloudwatch_metric_alarm.alb_unhealthy_hosts[0].alarm_name}) AND ALARM(${aws_cloudwatch_metric_alarm.alb_5xx_errors[0].alarm_name}))"

  alarm_actions = [aws_sns_topic.critical_alerts[0].arn]
  ok_actions    = [aws_sns_topic.critical_alerts[0].arn]

  tags = {
    Name     = "${local.name_prefix}-service-down-composite"
    Priority = "Critical"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# COMPOSITE ALARM - DATABASE ISSUES
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_composite_alarm" "database_issues" {
  count = local.is_production ? 1 : 0

  alarm_name        = "${local.name_prefix}-database-issues"
  alarm_description = "CRITICAL: Database performance issues detected"

  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.database_connection_errors[0].alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.rds_cpu[0].alarm_name})"

  alarm_actions = [aws_sns_topic.critical_alerts[0].arn]
  ok_actions    = [aws_sns_topic.critical_alerts[0].arn]

  tags = {
    Name     = "${local.name_prefix}-database-issues-composite"
    Priority = "Critical"
  }

  depends_on = [
    aws_cloudwatch_metric_alarm.database_connection_errors,
    aws_cloudwatch_metric_alarm.rds_cpu
  ]
}

# ─────────────────────────────────────────────────────────────────────────────────
# RDS ALARMS (referenced by composite, defined here for organization)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_db_cpu_threshold
  alarm_description   = "RDS CPU utilization is above ${var.alarm_db_cpu_threshold}%"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${local.name_prefix}-rds-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_db_storage_threshold * 1024 * 1024 * 1024  # Convert GB to bytes
  alarm_description   = "RDS free storage is below ${var.alarm_db_storage_threshold}GB"
  alarm_actions       = [aws_sns_topic.critical_alerts[0].arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name     = "${local.name_prefix}-rds-storage-alarm"
    Priority = "Critical"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_db_connections_threshold
  alarm_description   = "RDS connections exceed ${var.alarm_db_connections_threshold}"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name = "${local.name_prefix}-rds-connections-alarm"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ANOMALY DETECTION (Production)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "request_anomaly" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-request-anomaly"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 2
  threshold_metric_id = "ad1"
  alarm_description   = "Anomalous request pattern detected"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  metric_query {
    id          = "m1"
    return_data = true

    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"

      dimensions = {
        LoadBalancer = aws_lb.main.arn_suffix
      }
    }
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 2)"
    label       = "RequestCount (expected)"
    return_data = true
  }

  tags = {
    Name = "${local.name_prefix}-request-anomaly-alarm"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH INSIGHTS QUERIES (Saved)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${local.name_prefix}/Error-Analysis"

  log_group_names = [aws_cloudwatch_log_group.ecs.name]

  query_string = <<-EOT
    fields @timestamp, @message, @logStream
    | filter @message like /error|Error|ERROR/
    | parse @message /(?<error_type>Error|Exception|Failed).*?(?<error_message>[^"]+)/
    | stats count(*) as error_count by error_type, error_message
    | sort error_count desc
    | limit 20
  EOT
}

resource "aws_cloudwatch_query_definition" "slow_requests" {
  name = "${local.name_prefix}/Slow-Requests"

  log_group_names = [aws_cloudwatch_log_group.ecs.name]

  query_string = <<-EOT
    fields @timestamp, @message
    | filter @message like /response_time/
    | parse @message /"response_time":(?<response_time>\d+)/
    | filter response_time > 1000
    | sort response_time desc
    | limit 50
  EOT
}

resource "aws_cloudwatch_query_definition" "api_usage" {
  name = "${local.name_prefix}/API-Usage-By-Endpoint"

  log_group_names = [aws_cloudwatch_log_group.ecs.name]

  query_string = <<-EOT
    fields @timestamp, @message
    | filter @message like /HTTP/
    | parse @message /"method":"(?<method>\w+)","path":"(?<path>[^"]+)"/
    | stats count(*) as request_count by method, path
    | sort request_count desc
    | limit 30
  EOT
}

resource "aws_cloudwatch_query_definition" "user_activity" {
  name = "${local.name_prefix}/User-Activity"

  log_group_names = [aws_cloudwatch_log_group.ecs.name]

  query_string = <<-EOT
    fields @timestamp, @message
    | filter @message like /userId/
    | parse @message /"userId":"(?<user_id>[^"]+)"/
    | stats count(*) as action_count by user_id
    | sort action_count desc
    | limit 20
  EOT
}
