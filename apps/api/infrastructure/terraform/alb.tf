# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - APPLICATION LOAD BALANCER
# ═══════════════════════════════════════════════════════════════════════════════
# Internet-facing ALB with:
# - HTTPS termination (ACM certificate)
# - HTTP to HTTPS redirect
# - Health checks for ECS targets
# - Sticky sessions for stateful connections
# - Access logs to S3
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# APPLICATION LOAD BALANCER
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # ─────────────────────────────────────────────────────────────────────────────
  # PROTECTION & SETTINGS
  # ─────────────────────────────────────────────────────────────────────────────
  enable_deletion_protection = local.is_production
  enable_http2               = true
  idle_timeout               = var.alb_idle_timeout
  ip_address_type            = "ipv4"

  # Drop invalid headers for security
  drop_invalid_header_fields = true

  # ─────────────────────────────────────────────────────────────────────────────
  # ACCESS LOGS
  # ─────────────────────────────────────────────────────────────────────────────
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# TARGET GROUP - BACKEND API
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "backend" {
  name                 = "${local.name_prefix}-backend-tg"
  port                 = var.container_port
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"  # Required for Fargate
  deregistration_delay = var.alb_deregistration_delay

  # ─────────────────────────────────────────────────────────────────────────────
  # HEALTH CHECK
  # ─────────────────────────────────────────────────────────────────────────────
  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = var.alb_health_check_interval
    timeout             = var.alb_health_check_timeout
    healthy_threshold   = var.alb_healthy_threshold
    unhealthy_threshold = var.alb_unhealthy_threshold
    matcher             = "200"
  }

  # ─────────────────────────────────────────────────────────────────────────────
  # STICKY SESSIONS
  # ─────────────────────────────────────────────────────────────────────────────
  stickiness {
    type            = "lb_cookie"
    cookie_duration = var.alb_stickiness_duration
    enabled         = true
  }

  tags = {
    Name = "${local.name_prefix}-backend-tg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ACM CERTIFICATE
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${replace(var.domain_name, "api.", "")}",  # *.agrobridge.io
    replace(var.domain_name, "api.", "api-staging.")  # api-staging.agrobridge.io
  ]

  tags = {
    Name = "${local.name_prefix}-certificate"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records (if using Route53)
resource "aws_route53_record" "cert_validation" {
  for_each = var.hosted_zone_id != "" ? {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

resource "aws_acm_certificate_validation" "main" {
  count = var.hosted_zone_id != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ─────────────────────────────────────────────────────────────────────────────────
# HTTPS LISTENER (Port 443)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  tags = {
    Name = "${local.name_prefix}-https-listener"
  }

  # Wait for certificate validation if using Route53
  depends_on = [aws_acm_certificate_validation.main]
}

# ─────────────────────────────────────────────────────────────────────────────────
# HTTP LISTENER (Port 80) - Redirect to HTTPS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name = "${local.name_prefix}-http-listener"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# LISTENER RULES (Additional routing)
# ─────────────────────────────────────────────────────────────────────────────────

# Health check endpoint - bypass rate limiting
resource "aws_lb_listener_rule" "health_check" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/health", "/api/health/*"]
    }
  }

  tags = {
    Name = "${local.name_prefix}-health-rule"
  }
}

# API versioning - route /api/v1/* to backend
resource "aws_lb_listener_rule" "api_v1" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/v1/*", "/api/v1"]
    }
  }

  tags = {
    Name = "${local.name_prefix}-api-v1-rule"
  }
}

# Stripe webhooks - specific path for payment webhooks
resource "aws_lb_listener_rule" "stripe_webhook" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/webhooks/stripe", "/api/webhooks/stripe/*"]
    }
  }

  condition {
    http_request_method {
      values = ["POST"]
    }
  }

  tags = {
    Name = "${local.name_prefix}-stripe-webhook-rule"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ROUTE53 DNS RECORD
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_route53_record" "api" {
  count = var.hosted_zone_id != "" ? 1 : 0

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Staging subdomain
resource "aws_route53_record" "api_staging" {
  count = var.hosted_zone_id != "" && var.environment == "staging" ? 1 : 0

  zone_id = var.hosted_zone_id
  name    = replace(var.domain_name, "api.", "api-staging.")
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# S3 BUCKET FOR ALB ACCESS LOGS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "alb_logs" {
  bucket = "${var.s3_alb_logs_bucket}-${var.environment}-${local.account_id}"

  tags = {
    Name = "${local.name_prefix}-alb-logs"
  }
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "expire-logs"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ALB service account for the region
data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowALBLogDelivery"
        Effect = "Allow"
        Principal = {
          AWS = data.aws_elb_service_account.main.arn
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb/*"
      },
      {
        Sid    = "AllowALBLogDeliveryAcl"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "AllowALBLogDeliveryGetBucketAcl"
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDWATCH ALARMS FOR ALB
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_5xx_threshold
  alarm_description   = "ALB 5xx errors exceeded ${var.alarm_5xx_threshold} in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-alb-5xx-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx_errors" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-target-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_5xx_threshold
  alarm_description   = "Target 5xx errors exceeded ${var.alarm_5xx_threshold} in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.backend.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-target-5xx-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "ALB has unhealthy targets"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.backend.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-unhealthy-hosts-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p99"
  threshold           = 3  # 3 seconds p99 latency
  alarm_description   = "API p99 latency is above 3 seconds"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.backend.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-latency-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_request_count" {
  count = local.is_production ? 1 : 0

  alarm_name          = "${local.name_prefix}-high-request-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 50000  # Alert at 10K requests/minute
  alarm_description   = "High request volume - consider scaling"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-request-count-alarm"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# WAF WEB ACL (Optional - enable via variable)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0

  name        = "${local.name_prefix}-waf"
  description = "WAF for AgroBridge API"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = 2000  # requests per 5 minutes per IP
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude rules that might block legitimate API traffic
        rule_action_override {
          action_to_use {
            count {}
          }
          name = "SizeRestrictions_BODY"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - SQL Injection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-sqli-rules"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${local.name_prefix}-waf"
  }
}

resource "aws_wafv2_web_acl_association" "main" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}

# ─────────────────────────────────────────────────────────────────────────────────
# ALB SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# Endpoints:
#   Production: https://api.agrobridge.io
#   Staging:    https://api-staging.agrobridge.io
#
# Health Check: GET /api/health (200 OK)
#
# Routing:
#   /api/health/*     → Backend (priority 1)
#   /api/v1/*         → Backend (priority 10)
#   /api/webhooks/*   → Backend (priority 20)
#   /*                → Backend (default)
#
# Security:
#   - TLS 1.3 (ELBSecurityPolicy-TLS13-1-2-2021-06)
#   - HTTP → HTTPS redirect
#   - Drop invalid headers
#   - WAF (optional): Rate limiting, SQLi, XSS protection
#
# ─────────────────────────────────────────────────────────────────────────────────
