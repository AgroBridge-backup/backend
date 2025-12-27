#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════
# AgroBridge Backup Upload to S3
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Upload PostgreSQL backups to AWS S3 with verification
# Schedule: Run after postgres-backup completes (4 AM CST / 10 AM UTC)
# Storage: S3 Standard-IA for cost efficiency with 30-day lifecycle
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
S3_BUCKET="${S3_BUCKET:-${BACKUP_S3_BUCKET}}"
S3_PREFIX="${S3_PREFIX:-${BACKUP_S3_PREFIX:-agrobridge/backups}}"
DATE=$(date +%Y-%m-%d)
HOSTNAME=$(hostname)

# Logging functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo "[SUCCESS] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Validate environment
validate_environment() {
    log_info "Validating environment..."

    if [ -z "$S3_BUCKET" ]; then
        log_error "S3_BUCKET or BACKUP_S3_BUCKET environment variable is required"
        exit 1
    fi

    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        log_error "AWS credentials not configured"
        exit 1
    fi

    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory $BACKUP_DIR does not exist"
        exit 1
    fi

    log_info "Environment validated successfully"
}

# Find latest backup file
find_latest_backup() {
    log_info "Finding latest backup in $BACKUP_DIR..."

    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime -1 | sort -r | head -1)

    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No backup files found in the last 24 hours"
        exit 1
    fi

    BACKUP_SIZE=$(ls -lh "$LATEST_BACKUP" | awk '{print $5}')
    log_info "Found backup: $LATEST_BACKUP (Size: $BACKUP_SIZE)"

    echo "$LATEST_BACKUP"
}

# Upload backup to S3
upload_to_s3() {
    local backup_file="$1"
    local filename=$(basename "$backup_file")
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/postgres/${DATE}/${filename}"

    log_info "Uploading to $s3_path..."

    # Upload with metadata
    aws s3 cp "$backup_file" "$s3_path" \
        --storage-class STANDARD_IA \
        --metadata "hostname=${HOSTNAME},upload-date=${DATE},source=postgres-backup" \
        --only-show-errors

    if [ $? -eq 0 ]; then
        log_success "Upload completed: $s3_path"
        return 0
    else
        log_error "Upload failed for $backup_file"
        return 1
    fi
}

# Verify upload integrity
verify_upload() {
    local backup_file="$1"
    local filename=$(basename "$backup_file")
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/postgres/${DATE}/${filename}"

    log_info "Verifying upload integrity..."

    # Get local file checksum
    local local_md5=$(md5sum "$backup_file" | awk '{print $1}')

    # Get S3 object ETag (MD5 for single-part uploads)
    local s3_etag=$(aws s3api head-object --bucket "$S3_BUCKET" --key "${S3_PREFIX}/postgres/${DATE}/${filename}" --query 'ETag' --output text | tr -d '"')

    if [ "$local_md5" = "$s3_etag" ]; then
        log_success "Checksum verification passed"
        return 0
    else
        log_error "Checksum mismatch! Local: $local_md5, S3: $s3_etag"
        return 1
    fi
}

# Sync all backups (for catch-up scenarios)
sync_all_backups() {
    log_info "Syncing all backups to S3..."

    aws s3 sync "$BACKUP_DIR" "s3://${S3_BUCKET}/${S3_PREFIX}/postgres/" \
        --storage-class STANDARD_IA \
        --exclude "*.tmp" \
        --exclude "*.partial" \
        --only-show-errors

    if [ $? -eq 0 ]; then
        log_success "Full sync completed"
    else
        log_error "Sync failed"
        return 1
    fi
}

# Cleanup old S3 backups (optional - can also use S3 lifecycle policies)
cleanup_old_s3_backups() {
    local retention_days="${BACKUP_S3_RETENTION_DAYS:-90}"
    local cutoff_date=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null || date -v-${retention_days}d +%Y-%m-%d)

    log_info "Cleaning up S3 backups older than $retention_days days..."

    # List and delete old backups
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/postgres/" --recursive | while read -r line; do
        backup_date=$(echo "$line" | awk '{print $1}')
        if [ "$backup_date" \< "$cutoff_date" ]; then
            file_path=$(echo "$line" | awk '{print $4}')
            log_info "Deleting old backup: $file_path"
            aws s3 rm "s3://${S3_BUCKET}/$file_path" --only-show-errors
        fi
    done

    log_success "S3 cleanup completed"
}

# Send notification (Slack/Email)
send_notification() {
    local status="$1"
    local message="$2"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{
                \"text\": \"AgroBridge Backup: ${status}\",
                \"attachments\": [{
                    \"color\": \"$([ \"$status\" = \"SUCCESS\" ] && echo 'good' || echo 'danger')\",
                    \"fields\": [{
                        \"title\": \"Status\",
                        \"value\": \"${status}\",
                        \"short\": true
                    }, {
                        \"title\": \"Date\",
                        \"value\": \"${DATE}\",
                        \"short\": true
                    }, {
                        \"title\": \"Details\",
                        \"value\": \"${message}\",
                        \"short\": false
                    }]
                }]
            }"
    fi
}

# Main execution
main() {
    log_info "=========================================="
    log_info "AgroBridge S3 Backup Upload Starting"
    log_info "=========================================="

    validate_environment

    # Find and upload latest backup
    LATEST_BACKUP=$(find_latest_backup)

    if upload_to_s3 "$LATEST_BACKUP"; then
        if verify_upload "$LATEST_BACKUP"; then
            send_notification "SUCCESS" "Backup uploaded and verified: $(basename $LATEST_BACKUP)"
            log_success "=========================================="
            log_success "Backup upload completed successfully"
            log_success "=========================================="
            exit 0
        else
            send_notification "WARNING" "Backup uploaded but verification failed"
            exit 1
        fi
    else
        send_notification "FAILURE" "Backup upload failed"
        exit 1
    fi
}

# Run main
main "$@"
