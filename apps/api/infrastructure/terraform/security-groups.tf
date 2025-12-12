# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - SECURITY GROUPS
# ═══════════════════════════════════════════════════════════════════════════════
# Least privilege security groups for all infrastructure components
# Traffic flow: Internet → ALB → ECS → RDS/Redis
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# ALB SECURITY GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Allows inbound HTTP/HTTPS from the internet
# Outbound only to ECS tasks on container port

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: HTTPS from anywhere (primary traffic)
resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from internet"
}

# Ingress: HTTP from anywhere (redirects to HTTPS)
resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  ipv6_cidr_blocks  = ["::/0"]
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from internet (redirect to HTTPS)"
}

# Egress: Only to ECS tasks on container port
resource "aws_security_group_rule" "alb_egress_ecs" {
  type                     = "egress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id        = aws_security_group.alb.id
  description              = "To ECS tasks on container port"
}

# ─────────────────────────────────────────────────────────────────────────────────
# ECS SECURITY GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Allows inbound only from ALB on container port
# Outbound to RDS, Redis, and internet (via NAT for external APIs)

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for ECS Fargate tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-ecs-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: From ALB on container port only
resource "aws_security_group_rule" "ecs_ingress_alb" {
  type                     = "ingress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.ecs.id
  description              = "From ALB on container port"
}

# Ingress: Allow ECS tasks to communicate with each other (for distributed caching, etc.)
resource "aws_security_group_rule" "ecs_ingress_self" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "tcp"
  self              = true
  security_group_id = aws_security_group.ecs.id
  description       = "Allow ECS tasks to communicate with each other"
}

# Egress: To RDS PostgreSQL
resource "aws_security_group_rule" "ecs_egress_rds" {
  type                     = "egress"
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rds.id
  security_group_id        = aws_security_group.ecs.id
  description              = "To RDS PostgreSQL"
}

# Egress: To Redis
resource "aws_security_group_rule" "ecs_egress_redis" {
  type                     = "egress"
  from_port                = var.redis_port
  to_port                  = var.redis_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.redis.id
  security_group_id        = aws_security_group.ecs.id
  description              = "To ElastiCache Redis"
}

# Egress: HTTPS to internet (for external APIs: Stripe, SendGrid, Twilio, Firebase, etc.)
resource "aws_security_group_rule" "ecs_egress_https" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.ecs.id
  description       = "HTTPS to external APIs (Stripe, SendGrid, Twilio, Firebase)"
}

# Egress: HTTP (some APIs/webhooks may use HTTP)
resource "aws_security_group_rule" "ecs_egress_http" {
  type              = "egress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.ecs.id
  description       = "HTTP to external services"
}

# Egress: DNS resolution
resource "aws_security_group_rule" "ecs_egress_dns_udp" {
  type              = "egress"
  from_port         = 53
  to_port           = 53
  protocol          = "udp"
  cidr_blocks       = [var.vpc_cidr]
  security_group_id = aws_security_group.ecs.id
  description       = "DNS resolution (UDP)"
}

resource "aws_security_group_rule" "ecs_egress_dns_tcp" {
  type              = "egress"
  from_port         = 53
  to_port           = 53
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
  security_group_id = aws_security_group.ecs.id
  description       = "DNS resolution (TCP)"
}

# ─────────────────────────────────────────────────────────────────────────────────
# RDS SECURITY GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Allows inbound only from ECS tasks on PostgreSQL port
# No internet access (completely isolated)

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: From ECS tasks only
resource "aws_security_group_rule" "rds_ingress_ecs" {
  type                     = "ingress"
  from_port                = var.db_port
  to_port                  = var.db_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from ECS tasks"
}

# Ingress: From bastion host (if exists) - Uncomment when needed
# resource "aws_security_group_rule" "rds_ingress_bastion" {
#   type                     = "ingress"
#   from_port                = var.db_port
#   to_port                  = var.db_port
#   protocol                 = "tcp"
#   source_security_group_id = aws_security_group.bastion.id
#   security_group_id        = aws_security_group.rds.id
#   description              = "PostgreSQL from bastion host"
# }

# Egress: None needed - RDS doesn't initiate outbound connections
# But AWS requires at least one egress rule, so we allow VPC-internal only
resource "aws_security_group_rule" "rds_egress_internal" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = [var.vpc_cidr]
  security_group_id = aws_security_group.rds.id
  description       = "Internal VPC traffic only"
}

# ─────────────────────────────────────────────────────────────────────────────────
# REDIS SECURITY GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Allows inbound only from ECS tasks on Redis port
# No internet access (completely isolated)

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-redis-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress: From ECS tasks only
resource "aws_security_group_rule" "redis_ingress_ecs" {
  type                     = "ingress"
  from_port                = var.redis_port
  to_port                  = var.redis_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id        = aws_security_group.redis.id
  description              = "Redis from ECS tasks"
}

# Ingress: Redis cluster replication (node-to-node communication)
resource "aws_security_group_rule" "redis_ingress_self" {
  type              = "ingress"
  from_port         = var.redis_port
  to_port           = var.redis_port
  protocol          = "tcp"
  self              = true
  security_group_id = aws_security_group.redis.id
  description       = "Redis cluster replication"
}

# Egress: Internal VPC only (for cluster replication)
resource "aws_security_group_rule" "redis_egress_internal" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = [var.vpc_cidr]
  security_group_id = aws_security_group.redis.id
  description       = "Internal VPC traffic only"
}

# ─────────────────────────────────────────────────────────────────────────────────
# BASTION SECURITY GROUP (Optional - for database access during debugging)
# ─────────────────────────────────────────────────────────────────────────────────
# Uncomment when you need SSH access to the VPC for debugging
# Recommended: Use AWS Systems Manager Session Manager instead

# resource "aws_security_group" "bastion" {
#   name        = "${local.name_prefix}-bastion-sg"
#   description = "Security group for Bastion host"
#   vpc_id      = aws_vpc.main.id
#
#   tags = {
#     Name = "${local.name_prefix}-bastion-sg"
#   }
# }
#
# # Ingress: SSH from specific IPs only (your office/VPN)
# resource "aws_security_group_rule" "bastion_ingress_ssh" {
#   type              = "ingress"
#   from_port         = 22
#   to_port           = 22
#   protocol          = "tcp"
#   cidr_blocks       = ["YOUR_OFFICE_IP/32"]  # Replace with your IP
#   security_group_id = aws_security_group.bastion.id
#   description       = "SSH from office"
# }
#
# # Egress: To RDS and Redis
# resource "aws_security_group_rule" "bastion_egress_rds" {
#   type                     = "egress"
#   from_port                = var.db_port
#   to_port                  = var.db_port
#   protocol                 = "tcp"
#   source_security_group_id = aws_security_group.rds.id
#   security_group_id        = aws_security_group.bastion.id
#   description              = "To RDS"
# }
#
# resource "aws_security_group_rule" "bastion_egress_redis" {
#   type                     = "egress"
#   from_port                = var.redis_port
#   to_port                  = var.redis_port
#   protocol                 = "tcp"
#   source_security_group_id = aws_security_group.redis.id
#   security_group_id        = aws_security_group.bastion.id
#   description              = "To Redis"
# }

# ─────────────────────────────────────────────────────────────────────────────────
# SECURITY GROUP SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# Traffic Flow:
#
#   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
#   │   Internet   │ ──── │     ALB      │ ──── │     ECS      │
#   │              │      │  (80, 443)   │      │   (8080)     │
#   └──────────────┘      └──────────────┘      └──────────────┘
#                                                     │
#                                     ┌───────────────┼───────────────┐
#                                     │               │               │
#                                     ▼               ▼               ▼
#                               ┌──────────┐   ┌──────────┐   ┌──────────────┐
#                               │   RDS    │   │  Redis   │   │ External APIs│
#                               │  (5432)  │   │  (6379)  │   │   (HTTPS)    │
#                               └──────────┘   └──────────┘   └──────────────┘
#
# Key Security Principles:
# 1. ALB: Only accepts traffic on 80/443, forwards only to ECS
# 2. ECS: Only accepts traffic from ALB, can reach RDS/Redis/Internet
# 3. RDS: Only accepts traffic from ECS, no internet access
# 4. Redis: Only accepts traffic from ECS, no internet access
# 5. All egress is explicitly defined (no "allow all")
#
# ─────────────────────────────────────────────────────────────────────────────────
