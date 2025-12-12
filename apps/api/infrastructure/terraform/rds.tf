# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - RDS POSTGRESQL DATABASE
# ═══════════════════════════════════════════════════════════════════════════════
# Production-grade PostgreSQL 15 with:
# - Multi-AZ for high availability (production)
# - Encryption at rest (KMS) and in transit (SSL)
# - Automated backups with point-in-time recovery
# - Performance Insights for query analysis
# - Optimized parameter group for Prisma ORM
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# RANDOM PASSWORD GENERATION
# ─────────────────────────────────────────────────────────────────────────────────
# Secure password for RDS master user

resource "random_password" "db_password" {
  length           = var.db_password_length
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  # Exclude problematic characters for connection strings
}

# ─────────────────────────────────────────────────────────────────────────────────
# DB PARAMETER GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Optimized parameters for Node.js/Prisma ORM workload

resource "aws_db_parameter_group" "main" {
  name        = "${local.name_prefix}-pg15-params"
  family      = "postgres15"
  description = "Optimized PostgreSQL 15 parameters for AgroBridge"

  # ─────────────────────────────────────────────────────────────────────────────
  # CONNECTION SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "max_connections"
    value = var.db_max_connections
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # MEMORY SETTINGS (Dynamic based on instance class)
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "shared_buffers"
    # 25% of available memory (in 8KB pages)
    # For db.t3.medium (4GB): ~1GB
    # For db.r6g.xlarge (32GB): ~8GB
    value = "{DBInstanceClassMemory/32768}"
  }

  parameter {
    name  = "effective_cache_size"
    # 75% of available memory (in 8KB pages)
    value = "{DBInstanceClassMemory/10923}"
  }

  parameter {
    name  = "work_mem"
    # Memory per query operation (in KB)
    value = "16384"  # 16MB
  }

  parameter {
    name  = "maintenance_work_mem"
    # Memory for maintenance operations (in KB)
    value = "524288"  # 512MB
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # WRITE AHEAD LOG (WAL) SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "wal_buffers"
    # WAL buffer size (in 8KB pages)
    value = "2048"  # 16MB
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "checkpoint_timeout"
    value = "600"  # 10 minutes
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # QUERY PLANNER SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "random_page_cost"
    # Lower value for SSD storage (gp3)
    value = "1.1"
  }

  parameter {
    name  = "effective_io_concurrency"
    # Higher value for SSD storage
    value = "200"
  }

  parameter {
    name  = "default_statistics_target"
    # More accurate query planning
    value = "100"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # LOGGING SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "log_statement"
    value = "ddl"  # Log DDL statements (CREATE, ALTER, DROP)
  }

  parameter {
    name  = "log_min_duration_statement"
    # Log queries taking longer than 1 second
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_lock_waits"
    value = "1"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # AUTOVACUUM SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "autovacuum_vacuum_scale_factor"
    value = "0.05"  # More aggressive vacuuming
  }

  parameter {
    name  = "autovacuum_analyze_scale_factor"
    value = "0.025"
  }

  parameter {
    name  = "autovacuum_max_workers"
    value = "4"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # PRISMA ORM SPECIFIC
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "idle_in_transaction_session_timeout"
    # Kill idle transactions after 10 minutes (Prisma connection pooling)
    value = "600000"  # milliseconds
  }

  parameter {
    name  = "statement_timeout"
    # Maximum query execution time: 30 seconds
    value = "30000"  # milliseconds
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # SSL SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${local.name_prefix}-pg15-params"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# RDS INSTANCE
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  # ─────────────────────────────────────────────────────────────────────────────
  # ENGINE CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  engine               = "postgres"
  engine_version       = var.db_engine_version
  instance_class       = var.db_instance_class[var.environment]
  parameter_group_name = aws_db_parameter_group.main.name

  # ─────────────────────────────────────────────────────────────────────────────
  # DATABASE CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  db_name  = var.db_name
  username = "agrobridge_admin"
  password = random_password.db_password.result
  port     = var.db_port

  # ─────────────────────────────────────────────────────────────────────────────
  # STORAGE CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  allocated_storage     = var.db_allocated_storage[var.environment]
  max_allocated_storage = var.db_max_allocated_storage[var.environment]
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  # gp3 IOPS and throughput (baseline included, additional costs apply)
  iops                  = 3000   # Baseline for gp3
  storage_throughput    = 125    # MB/s baseline

  # ─────────────────────────────────────────────────────────────────────────────
  # NETWORK CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  network_type           = "IPV4"

  # ─────────────────────────────────────────────────────────────────────────────
  # HIGH AVAILABILITY
  # ─────────────────────────────────────────────────────────────────────────────
  multi_az               = var.db_multi_az[var.environment]
  availability_zone      = var.db_multi_az[var.environment] ? null : local.azs[0]

  # ─────────────────────────────────────────────────────────────────────────────
  # BACKUP CONFIGURATION
  # ─────────────────────────────────────────────────────────────────────────────
  backup_retention_period   = var.db_backup_retention_period[var.environment]
  backup_window             = var.db_backup_window
  maintenance_window        = var.db_maintenance_window
  copy_tags_to_snapshot     = true
  delete_automated_backups  = var.environment == "staging"
  skip_final_snapshot       = var.environment == "staging"
  final_snapshot_identifier = var.environment == "production" ? "${local.name_prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  # ─────────────────────────────────────────────────────────────────────────────
  # MONITORING & LOGGING
  # ─────────────────────────────────────────────────────────────────────────────
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Performance Insights (production only - additional cost)
  performance_insights_enabled          = var.db_performance_insights[var.environment]
  performance_insights_retention_period = var.db_performance_insights[var.environment] ? 7 : 0
  performance_insights_kms_key_id       = var.db_performance_insights[var.environment] ? aws_kms_key.rds.arn : null

  # Enhanced Monitoring (production only)
  monitoring_interval = local.is_production ? 60 : 0
  monitoring_role_arn = local.is_production ? aws_iam_role.rds_monitoring[0].arn : null

  # ─────────────────────────────────────────────────────────────────────────────
  # SECURITY & PROTECTION
  # ─────────────────────────────────────────────────────────────────────────────
  deletion_protection      = var.db_deletion_protection[var.environment]
  iam_database_authentication_enabled = true

  # CA certificate for SSL connections
  ca_cert_identifier = "rds-ca-rsa2048-g1"

  # ─────────────────────────────────────────────────────────────────────────────
  # AUTO MINOR VERSION UPGRADE
  # ─────────────────────────────────────────────────────────────────────────────
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false

  # ─────────────────────────────────────────────────────────────────────────────
  # TAGS
  # ─────────────────────────────────────────────────────────────────────────────
  tags = {
    Name        = "${local.name_prefix}-postgres"
    Backup      = local.is_production ? "daily" : "none"
    Compliance  = "PCI-DSS"
  }

  # Prevent recreation on password change
  lifecycle {
    ignore_changes = [
      password,
      final_snapshot_identifier
    ]
  }

  depends_on = [
    aws_db_parameter_group.main,
    aws_cloudwatch_log_group.rds_postgresql,
    aws_cloudwatch_log_group.rds_upgrade
  ]
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH LOG GROUPS FOR RDS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${local.name_prefix}-postgres/postgresql"
  retention_in_days = var.log_retention_days[var.environment]
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "${local.name_prefix}-rds-postgresql-logs"
  }
}

resource "aws_cloudwatch_log_group" "rds_upgrade" {
  name              = "/aws/rds/instance/${local.name_prefix}-postgres/upgrade"
  retention_in_days = var.log_retention_days[var.environment]
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "${local.name_prefix}-rds-upgrade-logs"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ENHANCED MONITORING IAM ROLE
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "rds_monitoring" {
  count = local.is_production ? 1 : 0

  name = "${local.name_prefix}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-rds-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = local.is_production ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ─────────────────────────────────────────────────────────────────────────────────
# DATABASE CONNECTION STRING (stored in Secrets Manager)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${local.name_prefix}/database/credentials"
  description = "RDS PostgreSQL credentials for ${var.app_name}"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  secret_string = jsonencode({
    username             = aws_db_instance.main.username
    password             = random_password.db_password.result
    engine               = "postgres"
    host                 = aws_db_instance.main.address
    port                 = aws_db_instance.main.port
    dbname               = aws_db_instance.main.db_name
    dbInstanceIdentifier = aws_db_instance.main.identifier
    # Prisma-compatible connection string
    DATABASE_URL         = "postgresql://${aws_db_instance.main.username}:${urlencode(random_password.db_password.result)}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?schema=public&connection_limit=10&pool_timeout=30&sslmode=require"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# READ REPLICA (Optional - for analytics/reporting)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_db_instance" "replica" {
  count = var.enable_read_replica && local.is_production ? 1 : 0

  identifier          = "${local.name_prefix}-postgres-replica"
  replicate_source_db = aws_db_instance.main.identifier

  instance_class    = var.db_instance_class["staging"]  # Smaller instance for analytics
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Replica-specific settings
  auto_minor_version_upgrade = true
  skip_final_snapshot        = true
  deletion_protection        = false

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id       = aws_kms_key.rds.arn

  tags = {
    Name = "${local.name_prefix}-postgres-replica"
    Role = "read-replica"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# RDS EVENT SUBSCRIPTION (Notifications)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_db_event_subscription" "main" {
  count = local.is_production && var.alarm_email != "" ? 1 : 0

  name      = "${local.name_prefix}-rds-events"
  sns_topic = aws_sns_topic.alerts[0].arn

  source_type = "db-instance"
  source_ids  = [aws_db_instance.main.identifier]

  event_categories = [
    "availability",
    "deletion",
    "failover",
    "failure",
    "low storage",
    "maintenance",
    "notification",
    "recovery",
    "restoration"
  ]

  tags = {
    Name = "${local.name_prefix}-rds-events"
  }
}
