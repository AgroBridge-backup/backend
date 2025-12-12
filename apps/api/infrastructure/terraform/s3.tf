# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - S3 STORAGE BUCKETS
# ═══════════════════════════════════════════════════════════════════════════════
# Storage infrastructure for:
# - Product images (public read via CloudFront)
# - User documents (private, signed URLs)
# - Application uploads and exports
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# PRODUCT IMAGES BUCKET (Public Read)
# ─────────────────────────────────────────────────────────────────────────────────
# Stores product photos, farm images, etc.
# Public read access for display in mobile apps

resource "aws_s3_bucket" "product_images" {
  bucket = "${var.s3_product_images_bucket}-${var.environment}-${local.account_id}"

  tags = {
    Name        = "${local.name_prefix}-product-images"
    Access      = "Public"
    ContentType = "Images"
  }
}

resource "aws_s3_bucket_versioning" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"  # Use S3-managed keys for public bucket
    }
  }
}

# CORS configuration for web/mobile access
resource "aws_s3_bucket_cors_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = local.is_production ? [
      "https://app.agrobridge.io",
      "https://www.agrobridge.io",
      "https://agrobridge.io"
    ] : ["*"]
    expose_headers  = ["ETag", "Content-Length"]
    max_age_seconds = 3600
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = local.is_production ? [
      "https://app.agrobridge.io",
      "https://api.agrobridge.io"
    ] : ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Lifecycle rules for cost optimization
resource "aws_s3_bucket_lifecycle_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    # Move to Infrequent Access after 90 days
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    # Move to Glacier after 365 days
    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    # Delete old versions after 30 days
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Public access block - Allow public read via bucket policy
resource "aws_s3_bucket_public_access_block" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  block_public_acls       = true
  block_public_policy     = false  # Allow public bucket policy
  ignore_public_acls      = true
  restrict_public_buckets = false  # Allow public access
}

# Bucket policy for public read
resource "aws_s3_bucket_policy" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.product_images.arn}/*"
      },
      {
        Sid    = "AllowECSTaskUpload"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task.arn
        }
        Action = [
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.product_images.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.product_images]
}

# ─────────────────────────────────────────────────────────────────────────────────
# USER DOCUMENTS BUCKET (Private)
# ─────────────────────────────────────────────────────────────────────────────────
# Stores private user documents, certificates, contracts
# Access only via pre-signed URLs

resource "aws_s3_bucket" "user_documents" {
  bucket = "${var.s3_user_documents_bucket}-${var.environment}-${local.account_id}"

  tags = {
    Name        = "${local.name_prefix}-user-documents"
    Access      = "Private"
    ContentType = "Documents"
    Compliance  = "PCI-DSS"
  }
}

resource "aws_s3_bucket_versioning" "user_documents" {
  bucket = aws_s3_bucket.user_documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# KMS encryption for private documents
resource "aws_s3_bucket_server_side_encryption_configuration" "user_documents" {
  bucket = aws_s3_bucket.user_documents.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true  # Reduce KMS costs
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "user_documents" {
  bucket = aws_s3_bucket.user_documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS for pre-signed URL uploads from mobile apps
resource "aws_s3_bucket_cors_configuration" "user_documents" {
  bucket = aws_s3_bucket.user_documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = local.is_production ? [
      "https://app.agrobridge.io",
      "https://api.agrobridge.io"
    ] : ["*"]
    expose_headers  = ["ETag", "x-amz-meta-*"]
    max_age_seconds = 3600
  }
}

# Lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "user_documents" {
  bucket = aws_s3_bucket.user_documents.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 180
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Object lock for compliance (optional - enable if needed)
# resource "aws_s3_bucket_object_lock_configuration" "user_documents" {
#   bucket = aws_s3_bucket.user_documents.id
#
#   rule {
#     default_retention {
#       mode = "GOVERNANCE"
#       days = 365
#     }
#   }
# }

# ─────────────────────────────────────────────────────────────────────────────────
# EXPORTS BUCKET (Private)
# ─────────────────────────────────────────────────────────────────────────────────
# Temporary storage for data exports, reports

resource "aws_s3_bucket" "exports" {
  bucket = "${var.app_name}-exports-${var.environment}-${local.account_id}"

  tags = {
    Name        = "${local.name_prefix}-exports"
    Access      = "Private"
    ContentType = "Exports"
  }
}

resource "aws_s3_bucket_versioning" "exports" {
  bucket = aws_s3_bucket.exports.id

  versioning_configuration {
    status = "Suspended"  # No versioning needed for temporary exports
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "exports" {
  bucket = aws_s3_bucket.exports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Auto-delete exports after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "exports" {
  bucket = aws_s3_bucket.exports.id

  rule {
    id     = "auto-delete-exports"
    status = "Enabled"

    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# BACKUPS BUCKET (Private, for RDS snapshots export)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "backups" {
  count = local.is_production ? 1 : 0

  bucket = "${var.app_name}-backups-${var.environment}-${local.account_id}"

  tags = {
    Name        = "${local.name_prefix}-backups"
    Access      = "Private"
    ContentType = "Backups"
    Compliance  = "Required"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  count  = local.is_production ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  count  = local.is_production ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  count  = local.is_production ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Keep backups for 1 year, then move to Glacier
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  count  = local.is_production ? 1 : 0
  bucket = aws_s3_bucket.backups[0].id

  rule {
    id     = "backup-lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# CLOUDFRONT DISTRIBUTION FOR PRODUCT IMAGES (Optional)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "product_images" {
  count = var.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN for ${var.app_name} product images"
  default_root_object = ""
  price_class         = "PriceClass_100"  # US, Canada, Europe

  origin {
    domain_name = aws_s3_bucket.product_images.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.product_images.id}"

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.product_images.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400     # 1 day
    max_ttl                = 31536000  # 1 year
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${local.name_prefix}-product-images-cdn"
  }
}

# ─────────────────────────────────────────────────────────────────────────────────
# S3 INVENTORY FOR COST ANALYSIS (Production)
# ─────────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_inventory" "product_images" {
  count = local.is_production ? 1 : 0

  bucket = aws_s3_bucket.product_images.id
  name   = "weekly-inventory"

  included_object_versions = "Current"

  schedule {
    frequency = "Weekly"
  }

  destination {
    bucket {
      format     = "CSV"
      bucket_arn = aws_s3_bucket.exports.arn
      prefix     = "inventory/product-images"
    }
  }

  optional_fields = [
    "Size",
    "LastModifiedDate",
    "StorageClass",
    "ETag"
  ]
}

# ─────────────────────────────────────────────────────────────────────────────────
# S3 BUCKET SUMMARY
# ─────────────────────────────────────────────────────────────────────────────────
#
# ┌────────────────────────────────────────────────────────────────────────────────┐
# │  Bucket                    │ Access   │ Encryption │ Versioning │ Lifecycle   │
# ├────────────────────────────────────────────────────────────────────────────────┤
# │  product-images-{env}      │ Public   │ AES256     │ Enabled    │ IA→Glacier  │
# │  user-documents-{env}      │ Private  │ KMS        │ Enabled    │ IA          │
# │  exports-{env}             │ Private  │ KMS        │ Disabled   │ 7d delete   │
# │  backups-{env} (prod)      │ Private  │ KMS        │ Enabled    │ Glacier→DA  │
# │  alb-logs-{env}            │ Private  │ AES256     │ Enabled    │ 90d delete  │
# └────────────────────────────────────────────────────────────────────────────────┘
#
# Storage Classes Used:
# - STANDARD: Frequently accessed (first 90 days)
# - STANDARD_IA: Infrequently accessed (90-365 days)
# - GLACIER: Archive (365+ days)
# - DEEP_ARCHIVE: Long-term archive (365+ days, backups)
#
# ─────────────────────────────────────────────────────────────────────────────────
