# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - CORE NETWORKING INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════
# VPC, Subnets, NAT Gateways, Internet Gateway, Route Tables
# Multi-AZ deployment across 3 Availability Zones for High Availability
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# VPC - VIRTUAL PRIVATE CLOUD
# ─────────────────────────────────────────────────────────────────────────────────
# Main network container for all AWS resources
# CIDR: 10.0.0.0/16 = 65,536 IP addresses

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # Enable DNS support for RDS, ElastiCache endpoints
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# INTERNET GATEWAY
# ─────────────────────────────────────────────────────────────────────────────────
# Provides internet access for resources in public subnets (ALB, NAT Gateways)

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# PUBLIC SUBNETS
# ─────────────────────────────────────────────────────────────────────────────────
# For: Application Load Balancer, NAT Gateways, Bastion hosts (if needed)
# Public IP assignment enabled for direct internet access

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-${local.azs[count.index]}"
    Tier = "Public"
    # Tags for EKS if migrating later
    "kubernetes.io/role/elb" = "1"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# PRIVATE SUBNETS
# ─────────────────────────────────────────────────────────────────────────────────
# For: ECS Fargate tasks (application containers)
# No public IP - internet access via NAT Gateway

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.private_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-${local.azs[count.index]}"
    Tier = "Private"
    # Tags for EKS if migrating later
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# DATABASE SUBNETS
# ─────────────────────────────────────────────────────────────────────────────────
# For: RDS PostgreSQL, ElastiCache Redis
# Isolated subnet group - no internet access (even via NAT)

resource "aws_subnet" "database" {
  count = length(var.database_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.database_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-database-${local.azs[count.index]}"
    Tier = "Database"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# ELASTIC IPs FOR NAT GATEWAYS
# ─────────────────────────────────────────────────────────────────────────────────
# Static IPs for NAT Gateways - important for whitelisting external services

resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(local.azs)) : 0

  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  }

  # EIP may require IGW to exist
  depends_on = [aws_internet_gateway.main]
}

# ─────────────────────────────────────────────────────────────────────────────────
# NAT GATEWAYS
# ─────────────────────────────────────────────────────────────────────────────────
# Provides internet access for private subnets (ECS tasks need to pull images,
# connect to external APIs like Stripe, SendGrid, Twilio, Firebase)
#
# Staging: 1 NAT Gateway (cost optimization)
# Production: 3 NAT Gateways (HA - one per AZ)

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(local.azs)) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${local.name_prefix}-nat-${local.azs[count.index]}"
  }

  # NAT Gateway requires IGW
  depends_on = [aws_internet_gateway.main]
}

# ─────────────────────────────────────────────────────────────────────────────────
# ROUTE TABLES - PUBLIC
# ─────────────────────────────────────────────────────────────────────────────────
# Routes all traffic (0.0.0.0/0) to Internet Gateway

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-public-rt"
    Tier = "Public"
  }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ─────────────────────────────────────────────────────────────────────────────────
# ROUTE TABLES - PRIVATE
# ─────────────────────────────────────────────────────────────────────────────────
# Routes internet traffic through NAT Gateway
# Multiple route tables for HA (one per AZ) when using multiple NAT Gateways

resource "aws_route_table" "private" {
  count = var.single_nat_gateway ? 1 : length(local.azs)

  vpc_id = aws_vpc.main.id

  tags = {
    Name = var.single_nat_gateway ? "${local.name_prefix}-private-rt" : "${local.name_prefix}-private-rt-${local.azs[count.index]}"
    Tier = "Private"
  }
}

resource "aws_route" "private_nat" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(local.azs)) : 0

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[count.index].id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id = aws_subnet.private[count.index].id
  # If single NAT, all subnets use the same route table
  # If multiple NATs, each subnet uses its AZ's route table
  route_table_id = var.single_nat_gateway ? aws_route_table.private[0].id : aws_route_table.private[count.index].id
}

# ─────────────────────────────────────────────────────────────────────────────────
# ROUTE TABLES - DATABASE
# ─────────────────────────────────────────────────────────────────────────────────
# Isolated - no internet access
# Only local VPC traffic allowed

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-database-rt"
    Tier = "Database"
  }
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# ─────────────────────────────────────────────────────────────────────────────────
# VPC FLOW LOGS
# ─────────────────────────────────────────────────────────────────────────────────
# Capture network traffic for security analysis and debugging

resource "aws_flow_log" "main" {
  count = local.is_production ? 1 : 0

  iam_role_arn    = aws_iam_role.flow_log[0].arn
  log_destination = aws_cloudwatch_log_group.flow_log[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-flow-log"
  }
}

resource "aws_cloudwatch_log_group" "flow_log" {
  count = local.is_production ? 1 : 0

  name              = "/aws/vpc/${local.name_prefix}-flow-logs"
  retention_in_days = var.log_retention_days[var.environment]

  tags = {
    Name = "${local.name_prefix}-flow-log-group"
  }
}

resource "aws_iam_role" "flow_log" {
  count = local.is_production ? 1 : 0

  name = "${local.name_prefix}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-flow-log-role"
  }
}

resource "aws_iam_role_policy" "flow_log" {
  count = local.is_production ? 1 : 0

  name = "${local.name_prefix}-flow-log-policy"
  role = aws_iam_role.flow_log[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────────
# VPC ENDPOINTS (Optional but recommended for production)
# ─────────────────────────────────────────────────────────────────────────────────
# Reduces NAT Gateway costs and improves security by keeping AWS traffic private

# S3 Gateway Endpoint - Free, reduces NAT Gateway data transfer costs
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(
    [aws_route_table.private[0].id],
    var.single_nat_gateway ? [] : [for rt in aws_route_table.private : rt.id]
  )

  tags = {
    Name = "${local.name_prefix}-s3-endpoint"
  }
}

# ECR API Endpoint - Reduces image pull latency and NAT costs
resource "aws_vpc_endpoint" "ecr_api" {
  count = local.is_production ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-ecr-api-endpoint"
  }
}

# ECR DKR Endpoint - For Docker image pulls
resource "aws_vpc_endpoint" "ecr_dkr" {
  count = local.is_production ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-ecr-dkr-endpoint"
  }
}

# CloudWatch Logs Endpoint
resource "aws_vpc_endpoint" "logs" {
  count = local.is_production ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-logs-endpoint"
  }
}

# Secrets Manager Endpoint
resource "aws_vpc_endpoint" "secretsmanager" {
  count = local.is_production ? 1 : 0

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name_prefix}-secretsmanager-endpoint"
  }
}

# Security Group for VPC Endpoints
resource "aws_security_group" "vpc_endpoints" {
  count = local.is_production ? 1 : 0

  name        = "${local.name_prefix}-vpc-endpoints-sg"
  description = "Security group for VPC endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-vpc-endpoints-sg"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# DB SUBNET GROUP
# ─────────────────────────────────────────────────────────────────────────────────
# Required for RDS and ElastiCache to know which subnets to use

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${var.app_name}"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-redis-subnet-group"
  description = "Redis subnet group for ${var.app_name}"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name = "${local.name_prefix}-redis-subnet-group"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# NETWORK ACLs (Optional additional security layer)
# ─────────────────────────────────────────────────────────────────────────────────
# Using default NACL with allow all - Security Groups provide primary filtering
# Uncomment and customize if stricter network-level controls needed

# resource "aws_network_acl" "database" {
#   vpc_id     = aws_vpc.main.id
#   subnet_ids = aws_subnet.database[*].id
#
#   # Allow PostgreSQL from private subnets only
#   ingress {
#     protocol   = "tcp"
#     rule_no    = 100
#     action     = "allow"
#     cidr_block = var.vpc_cidr
#     from_port  = 5432
#     to_port    = 5432
#   }
#
#   # Allow Redis from private subnets only
#   ingress {
#     protocol   = "tcp"
#     rule_no    = 110
#     action     = "allow"
#     cidr_block = var.vpc_cidr
#     from_port  = 6379
#     to_port    = 6379
#   }
#
#   # Allow return traffic (ephemeral ports)
#   ingress {
#     protocol   = "tcp"
#     rule_no    = 200
#     action     = "allow"
#     cidr_block = var.vpc_cidr
#     from_port  = 1024
#     to_port    = 65535
#   }
#
#   egress {
#     protocol   = "-1"
#     rule_no    = 100
#     action     = "allow"
#     cidr_block = var.vpc_cidr
#     from_port  = 0
#     to_port    = 0
#   }
#
#   tags = {
#     Name = "${local.name_prefix}-database-nacl"
#   }
# }
