# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - SECRETS MANAGER
# ═══════════════════════════════════════════════════════════════════════════════
# Centralized secrets management with:
# - KMS encryption
# - Automatic rotation (for supported secrets)
# - Version control
# - Access audit via CloudTrail
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# KMS KEY FOR SECRETS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_kms_key" "secrets" {
  description             = "KMS key for Secrets Manager - ${var.app_name}"
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
        Sid    = "Allow Secrets Manager"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
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
        Sid    = "Allow ECS Task Role"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task_execution.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-secrets-key"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.name_prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# ─────────────────────────────────────────────────────────────────────────────────
# JWT SECRETS
# ─────────────────────────────────────────────────────────────────────────────────

# JWT Access Token Secret
resource "random_password" "jwt_secret" {
  length  = var.jwt_secret_length
  special = true
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${local.name_prefix}/jwt/access-secret"
  description = "JWT access token signing secret"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-jwt-secret"
    Type = "jwt"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# JWT Refresh Token Secret
resource "random_password" "jwt_refresh_secret" {
  length  = var.jwt_secret_length
  special = true
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name        = "${local.name_prefix}/jwt/refresh-secret"
  description = "JWT refresh token signing secret"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-jwt-refresh-secret"
    Type = "jwt"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = random_password.jwt_refresh_secret.result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# STRIPE SECRETS
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "stripe_secret" {
  name        = "${local.name_prefix}/stripe/secret-key"
  description = "Stripe API secret key"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-stripe-secret"
    Type = "payment"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_secret" {
  secret_id     = aws_secretsmanager_secret.stripe_secret.id
  secret_string = "sk_test_PLACEHOLDER_UPDATE_ME"  # Placeholder - update after creation

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name        = "${local.name_prefix}/stripe/webhook-secret"
  description = "Stripe webhook signing secret"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-stripe-webhook-secret"
    Type = "payment"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.stripe_webhook_secret.id
  secret_string = "whsec_PLACEHOLDER_UPDATE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Stripe Publishable Key (not sensitive but convenient to store together)
resource "aws_secretsmanager_secret" "stripe_publishable" {
  name        = "${local.name_prefix}/stripe/publishable-key"
  description = "Stripe API publishable key"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-stripe-publishable"
    Type = "payment"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_publishable" {
  secret_id     = aws_secretsmanager_secret.stripe_publishable.id
  secret_string = "pk_test_PLACEHOLDER_UPDATE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# SENDGRID (EMAIL)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "sendgrid_api_key" {
  name        = "${local.name_prefix}/sendgrid/api-key"
  description = "SendGrid API key for transactional emails"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-sendgrid-api-key"
    Type = "email"
  }
}

resource "aws_secretsmanager_secret_version" "sendgrid_api_key" {
  secret_id     = aws_secretsmanager_secret.sendgrid_api_key.id
  secret_string = "SG.PLACEHOLDER_UPDATE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# TWILIO (SMS)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "twilio_credentials" {
  name        = "${local.name_prefix}/twilio/credentials"
  description = "Twilio credentials for SMS notifications"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-twilio-credentials"
    Type = "sms"
  }
}

resource "aws_secretsmanager_secret_version" "twilio_credentials" {
  secret_id = aws_secretsmanager_secret.twilio_credentials.id

  secret_string = jsonencode({
    TWILIO_ACCOUNT_SID  = "AC_PLACEHOLDER_UPDATE_ME"
    TWILIO_AUTH_TOKEN   = "PLACEHOLDER_UPDATE_ME"
    TWILIO_PHONE_NUMBER = "+1XXXXXXXXXX"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# FIREBASE (PUSH NOTIFICATIONS & AUTH)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "firebase_credentials" {
  name        = "${local.name_prefix}/firebase/service-account"
  description = "Firebase Admin SDK service account credentials"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-firebase-credentials"
    Type = "auth"
  }
}

resource "aws_secretsmanager_secret_version" "firebase_credentials" {
  secret_id = aws_secretsmanager_secret.firebase_credentials.id

  # Firebase service account JSON structure
  secret_string = jsonencode({
    type                        = "service_account"
    project_id                  = "agrobridge-PLACEHOLDER"
    private_key_id              = "PLACEHOLDER"
    private_key                 = "-----BEGIN PRIVATE KEY-----\nPLACEHOLDER\n-----END PRIVATE KEY-----\n"
    client_email                = "firebase-adminsdk@agrobridge-PLACEHOLDER.iam.gserviceaccount.com"
    client_id                   = "PLACEHOLDER"
    auth_uri                    = "https://accounts.google.com/o/oauth2/auth"
    token_uri                   = "https://oauth2.googleapis.com/token"
    auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
    client_x509_cert_url        = "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40agrobridge-PLACEHOLDER.iam.gserviceaccount.com"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# APPLE PUSH NOTIFICATIONS (APNs)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "apns_key" {
  name        = "${local.name_prefix}/apns/auth-key"
  description = "Apple Push Notification service .p8 key"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-apns-key"
    Type = "push"
  }
}

resource "aws_secretsmanager_secret_version" "apns_key" {
  secret_id = aws_secretsmanager_secret.apns_key.id

  secret_string = jsonencode({
    key_id   = "XXXXXXXXXX"
    team_id  = "XXXXXXXXXX"
    key_file = "-----BEGIN PRIVATE KEY-----\nPLACEHOLDER\n-----END PRIVATE KEY-----"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# BLOCKCHAIN / WEB3 (Future)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "blockchain_private_key" {
  name        = "${local.name_prefix}/blockchain/private-key"
  description = "Blockchain wallet private key for smart contract interactions"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-blockchain-key"
    Type = "blockchain"
  }
}

resource "aws_secretsmanager_secret_version" "blockchain_private_key" {
  secret_id = aws_secretsmanager_secret.blockchain_private_key.id

  secret_string = jsonencode({
    private_key      = "0xPLACEHOLDER"
    wallet_address   = "0xPLACEHOLDER"
    infura_api_key   = "PLACEHOLDER"
    alchemy_api_key  = "PLACEHOLDER"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# IPFS (Decentralized Storage)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "ipfs_credentials" {
  name        = "${local.name_prefix}/ipfs/credentials"
  description = "IPFS/Pinata credentials for decentralized storage"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-ipfs-credentials"
    Type = "storage"
  }
}

resource "aws_secretsmanager_secret_version" "ipfs_credentials" {
  secret_id = aws_secretsmanager_secret.ipfs_credentials.id

  secret_string = jsonencode({
    pinata_api_key    = "PLACEHOLDER"
    pinata_secret_key = "PLACEHOLDER"
    pinata_jwt        = "PLACEHOLDER"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# AGROGPT (AI/ML)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "openai_api_key" {
  name        = "${local.name_prefix}/ai/openai-api-key"
  description = "OpenAI API key for AgroGPT functionality"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-openai-api-key"
    Type = "ai"
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = "sk-PLACEHOLDER_UPDATE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# APPLICATION SECRETS (General)
# ─────────────────────────────────────────────────────────────────────────────────

resource "random_password" "app_encryption_key" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app_encryption_key" {
  name        = "${local.name_prefix}/app/encryption-key"
  description = "Application-level encryption key for sensitive data"
  kms_key_id  = aws_kms_key.secrets.arn

  tags = {
    Name = "${local.name_prefix}-app-encryption-key"
    Type = "app"
  }
}

resource "aws_secretsmanager_secret_version" "app_encryption_key" {
  secret_id     = aws_secretsmanager_secret.app_encryption_key.id
  secret_string = random_password.app_encryption_key.result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# SECRETS ROTATION (Optional - for RDS)
# ─────────────────────────────────────────────────────────────────────────────────
# Uncomment to enable automatic password rotation for RDS

# resource "aws_secretsmanager_secret_rotation" "db_credentials" {
#   secret_id           = aws_secretsmanager_secret.db_credentials.id
#   rotation_lambda_arn = aws_lambda_function.rotate_secret.arn
#
#   rotation_rules {
#     automatically_after_days = 90
#   }
# }

# ─────────────────────────────────────────────────────────────────────────────────
# SECRETS SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# Auto-generated (secure random):
#   - JWT Access Secret (64 chars)
#   - JWT Refresh Secret (64 chars)
#   - App Encryption Key (32 chars)
#   - Database Password (in rds.tf)
#   - Redis Auth Token (in elasticache.tf)
#
# Placeholder (UPDATE REQUIRED):
#   - Stripe Secret Key
#   - Stripe Webhook Secret
#   - Stripe Publishable Key
#   - SendGrid API Key
#   - Twilio Credentials (SID, Token, Phone)
#   - Firebase Service Account (JSON)
#   - APNs Auth Key (.p8)
#   - Blockchain Private Key
#   - IPFS/Pinata Credentials
#   - OpenAI API Key
#
# Update secrets after Terraform apply:
#   aws secretsmanager update-secret \
#     --secret-id agrobridge-production/stripe/secret-key \
#     --secret-string "sk_live_xxx"
#
# ─────────────────────────────────────────────────────────────────────────────────
