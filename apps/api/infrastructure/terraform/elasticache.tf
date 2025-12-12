# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - ELASTICACHE REDIS CLUSTER
# ═══════════════════════════════════════════════════════════════════════════════
# Production-grade Redis 7 with:
# - Replication group for high availability
# - Automatic failover (production)
# - Encryption at rest (KMS) and in transit (TLS)
# - Auth token for security
# - Optimized for: Sessions, Rate Limiting, Bull Queues, Pub/Sub
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# RANDOM AUTH TOKEN GENERATION
# ─────────────────────────────────────────────────────────────────────────────────
# Redis AUTH token for authentication

resource "random_password" "redis_auth_token" {
  length  = var.redis_auth_token_length
  special = false  # Redis auth token doesn't support special characters
  upper   = true
  lower   = true
  numeric = true
}

# ─────────────────────────────────────────────────────────────────────────────────
# REDIS PARAMETER GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Optimized for Node.js/ioredis/Bull workloads

resource "aws_elasticache_parameter_group" "main" {
  name        = "${local.name_prefix}-redis7-params"
  family      = "redis7"
  description = "Optimized Redis 7 parameters for AgroBridge"

  # ─────────────────────────────────────────────────────────────────────────────
  # MEMORY MANAGEMENT
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "maxmemory-policy"
    # allkeys-lru: Evict least recently used keys when memory is full
    # Best for caching use case (sessions, rate limiting)
    value = "allkeys-lru"
  }

  parameter {
    name  = "maxmemory-samples"
    # More samples = more accurate LRU but higher CPU
    value = "10"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # CONNECTION SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "timeout"
    # Close idle connections after 5 minutes (0 = never)
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    # Send TCP keepalive every 60 seconds
    value = "60"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # PERSISTENCE (Disabled for pure caching, enabled for Bull queues)
  # ─────────────────────────────────────────────────────────────────────────────
  # Note: ElastiCache handles persistence automatically with snapshots
  # These are for in-memory behavior

  # ─────────────────────────────────────────────────────────────────────────────
  # PUB/SUB SETTINGS (for real-time notifications)
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "notify-keyspace-events"
    # Enable keyspace notifications for Bull queue events
    # K = Keyspace events, E = Keyevent events, x = Expired events
    value = "KEx"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # CLIENT OUTPUT BUFFER (for Pub/Sub)
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "client-output-buffer-limit-pubsub-hard-limit"
    value = "33554432"  # 32MB
  }

  parameter {
    name  = "client-output-buffer-limit-pubsub-soft-limit"
    value = "8388608"  # 8MB
  }

  parameter {
    name  = "client-output-buffer-limit-pubsub-soft-seconds"
    value = "60"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # SLOW LOG (for debugging)
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "slowlog-log-slower-than"
    # Log queries slower than 10ms (in microseconds)
    value = "10000"
  }

  parameter {
    name  = "slowlog-max-len"
    value = "128"
  }

  tags = {
    Name = "${local.name_prefix}-redis7-params"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# REDIS REPLICATION GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Primary + Replica(s) for high availability

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis cluster for ${var.app_name} - sessions, cache, queues"

  # ─────────────────────────────────────────────────────────────────────────────
  # ENGINE CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type[var.environment]
  port                 = var.redis_port
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # ─────────────────────────────────────────────────────────────────────────────
  # CLUSTER CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  num_cache_clusters         = var.redis_num_cache_clusters[var.environment]
  automatic_failover_enabled = var.redis_automatic_failover[var.environment]
  multi_az_enabled           = var.redis_automatic_failover[var.environment]

  # ─────────────────────────────────────────────────────────────────────────────
  # NETWORK CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # ─────────────────────────────────────────────────────────────────────────────
  # SECURITY - ENCRYPTION
  # ─────────────────────────────────────────────────────────────────────────────
  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.redis.arn
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  # ─────────────────────────────────────────────────────────────────────────────
  # BACKUP CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  snapshot_retention_limit = var.redis_snapshot_retention[var.environment]
  snapshot_window          = var.redis_snapshot_window
  final_snapshot_identifier = local.is_production ? "${local.name_prefix}-redis-final" : null

  # ─────────────────────────────────────────────────────────────────────────────
  # MAINTENANCE
  # ─────────────────────────────────────────────────────────────────────────────
  maintenance_window       = "sun:06:00-sun:08:00"  # After RDS maintenance
  auto_minor_version_upgrade = true
  apply_immediately        = var.environment == "staging"

  # ─────────────────────────────────────────────────────────────────────────────
  # NOTIFICATIONS
  # ─────────────────────────────────────────────────────────────────────────────
  notification_topic_arn = local.is_production && var.alarm_email != "" ? aws_sns_topic.alerts[0].arn : null

  # ─────────────────────────────────────────────────────────────────────────────
  # LOGGING (Redis 7+)
  # ─────────────────────────────────────────────────────────────────────────────
  dynamic "log_delivery_configuration" {
    for_each = local.is_production ? [1] : []
    content {
      destination      = aws_cloudwatch_log_group.redis_slow_log[0].name
      destination_type = "cloudwatch-logs"
      log_format       = "json"
      log_type         = "slow-log"
    }
  }

  dynamic "log_delivery_configuration" {
    for_each = local.is_production ? [1] : []
    content {
      destination      = aws_cloudwatch_log_group.redis_engine_log[0].name
      destination_type = "cloudwatch-logs"
      log_format       = "json"
      log_type         = "engine-log"
    }
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # TAGS
  # ─────────────────────────────────────────────────────────────────────────────
  tags = {
    Name = "${local.name_prefix}-redis"
    Use  = "sessions,cache,queues,pubsub"
  }

  lifecycle {
    ignore_changes = [
      auth_token,
      final_snapshot_identifier
    ]
  }

  depends_on = [
    aws_elasticache_parameter_group.main
  ]
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH LOG GROUPS FOR REDIS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "redis_slow_log" {
  count = local.is_production ? 1 : 0

  name              = "/aws/elasticache/${local.name_prefix}-redis/slow-log"
  retention_in_days = var.log_retention_days[var.environment]
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "${local.name_prefix}-redis-slow-log"
  }
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  count = local.is_production ? 1 : 0

  name              = "/aws/elasticache/${local.name_prefix}-redis/engine-log"
  retention_in_days = var.log_retention_days[var.environment]
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "${local.name_prefix}-redis-engine-log"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# REDIS CONNECTION STRING (stored in Secrets Manager)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "redis_credentials" {
  name        = "${local.name_prefix}/redis/credentials"
  description = "ElastiCache Redis credentials for ${var.app_name}"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-redis-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id

  secret_string = jsonencode({
    auth_token           = random_password.redis_auth_token.result
    host                 = aws_elasticache_replication_group.main.primary_endpoint_address
    port                 = var.redis_port
    reader_endpoint      = aws_elasticache_replication_group.main.reader_endpoint_address
    # ioredis-compatible connection string (TLS enabled)
    REDIS_URL            = "rediss://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:${var.redis_port}"
    REDIS_READER_URL     = "rediss://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.main.reader_endpoint_address}:${var.redis_port}"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH ALARMS FOR REDIS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis CPU utilization is above 75%"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    CacheClusterId = "${local.name_prefix}-redis-001"
  }

  tags = {
    Name = "${local.name_prefix}-redis-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.alarm_redis_memory_threshold
  alarm_description   = "Redis memory usage is above ${var.alarm_redis_memory_threshold}%"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    CacheClusterId = "${local.name_prefix}-redis-001"
  }

  tags = {
    Name = "${local.name_prefix}-redis-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-evictions-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000  # More than 1000 evictions in 5 minutes
  alarm_description   = "Redis is evicting keys - consider scaling up"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    CacheClusterId = "${local.name_prefix}-redis-001"
  }

  tags = {
    Name = "${local.name_prefix}-redis-evictions-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 500  # Approaching default max of 65000
  alarm_description   = "Redis connection count is high"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    CacheClusterId = "${local.name_prefix}-redis-001"
  }

  tags = {
    Name = "${local.name_prefix}-redis-connections-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_replication_lag" {
  count = local.is_production && var.redis_num_cache_clusters["production"] > 1 ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 1  # More than 1 second lag
  alarm_description   = "Redis replication lag is high - replica may be behind"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    CacheClusterId = "${local.name_prefix}-redis-002"  # Replica
  }

  tags = {
    Name = "${local.name_prefix}-redis-replication-lag-alarm"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# REDIS USE CASES DOCUMENTATION
# ─────────────────────────────────────────────────────────────────────────────────
#
# AgroBridge Redis Usage:
#
# 1. SESSION STORAGE (JWT refresh tokens)
#    Key pattern: session:{userId}
#    TTL: 7 days
#    Commands: SET, GET, DEL, EXPIRE
#
# 2. RATE LIMITING (express-rate-limit + ioredis)
#    Key pattern: ratelimit:{ip}:{endpoint}
#    TTL: 1-15 minutes
#    Commands: INCR, EXPIRE, GET
#
# 3. BULL QUEUES (background jobs)
#    Key patterns: bull:{queueName}:*
#    - Notification queue
#    - Email queue
#    - SMS queue
#    Commands: LPUSH, BRPOPLPUSH, ZADD, ZRANGEBYSCORE
#
# 4. PUB/SUB (real-time notifications)
#    Channels: notifications:{userId}, events:{eventId}
#    Commands: PUBLISH, SUBSCRIBE
#
# 5. CACHING
#    Key patterns:
#    - user:{userId} (user profile cache)
#    - product:{productId} (product data)
#    - farm:{farmId} (farm details)
#    TTL: 5-60 minutes
#    Commands: GET, SET, MGET, DEL
#
# ─────────────────────────────────────────────────────────────────────────────────
