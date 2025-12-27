#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════
# AgroBridge Backup Health Check
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Monitor backup freshness and alert if backups are stale
# Schedule: Runs hourly via backup-monitor container
# Alerts: Slack webhook and/or email notifications
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
MAX_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"  # Allow 2 hours buffer for 24h schedule
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-agrobridge/backups}"

# Logging functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_success() {
    echo "[SUCCESS] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check local backup freshness
check_local_backup() {
    log_info "Checking local backup freshness..."

    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi

    # Find most recent backup
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | head -1)

    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No backup files found in $BACKUP_DIR"
        return 1
    fi

    # Get backup age in hours
    BACKUP_TIME=$(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP" 2>/dev/null)
    CURRENT_TIME=$(date +%s)
    AGE_SECONDS=$((CURRENT_TIME - BACKUP_TIME))
    AGE_HOURS=$((AGE_SECONDS / 3600))

    BACKUP_SIZE=$(ls -lh "$LATEST_BACKUP" | awk '{print $5}')
    BACKUP_NAME=$(basename "$LATEST_BACKUP")

    log_info "Latest backup: $BACKUP_NAME"
    log_info "Backup size: $BACKUP_SIZE"
    log_info "Backup age: ${AGE_HOURS} hours"

    if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
        log_error "Backup is stale! Age: ${AGE_HOURS}h, Max allowed: ${MAX_AGE_HOURS}h"
        return 1
    fi

    log_success "Local backup is fresh (${AGE_HOURS}h old)"
    return 0
}

# Check S3 backup (if configured)
check_s3_backup() {
    if [ -z "$S3_BUCKET" ]; then
        log_info "S3 bucket not configured, skipping S3 check"
        return 0
    fi

    if ! command -v aws >/dev/null 2>&1; then
        log_warn "AWS CLI not available, skipping S3 check"
        return 0
    fi

    log_info "Checking S3 backup freshness..."

    # Get latest S3 backup
    LATEST_S3=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/postgres/" --recursive 2>/dev/null | sort | tail -1)

    if [ -z "$LATEST_S3" ]; then
        log_error "No backups found in S3"
        return 1
    fi

    # Parse S3 listing (format: date time size path)
    S3_DATE=$(echo "$LATEST_S3" | awk '{print $1}')
    S3_TIME=$(echo "$LATEST_S3" | awk '{print $2}')
    S3_SIZE=$(echo "$LATEST_S3" | awk '{print $3}')
    S3_PATH=$(echo "$LATEST_S3" | awk '{print $4}')

    log_info "Latest S3 backup: $S3_PATH"
    log_info "S3 backup date: $S3_DATE $S3_TIME"
    log_info "S3 backup size: $S3_SIZE bytes"

    # Check if S3 backup is from today or yesterday
    TODAY=$(date +%Y-%m-%d)
    YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)

    if [ "$S3_DATE" != "$TODAY" ] && [ "$S3_DATE" != "$YESTERDAY" ]; then
        log_warn "S3 backup may be stale (last: $S3_DATE)"
    else
        log_success "S3 backup is current ($S3_DATE)"
    fi

    return 0
}

# Check backup file size (detect empty/corrupted backups)
check_backup_size() {
    log_info "Checking backup file sizes..."

    MIN_SIZE_KB="${MIN_BACKUP_SIZE_KB:-100}"  # Minimum 100KB

    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | head -1)

    if [ -z "$LATEST_BACKUP" ]; then
        return 1
    fi

    # Get size in KB
    SIZE_KB=$(du -k "$LATEST_BACKUP" | cut -f1)

    if [ "$SIZE_KB" -lt "$MIN_SIZE_KB" ]; then
        log_error "Backup file is suspiciously small: ${SIZE_KB}KB (min: ${MIN_SIZE_KB}KB)"
        return 1
    fi

    log_success "Backup size is acceptable: ${SIZE_KB}KB"
    return 0
}

# Check disk space for backups
check_disk_space() {
    log_info "Checking disk space..."

    MIN_FREE_PERCENT="${MIN_DISK_FREE_PERCENT:-20}"

    # Get disk usage for backup directory
    DISK_USAGE=$(df "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
    FREE_PERCENT=$((100 - DISK_USAGE))

    log_info "Disk free: ${FREE_PERCENT}%"

    if [ "$FREE_PERCENT" -lt "$MIN_FREE_PERCENT" ]; then
        log_warn "Disk space is low: ${FREE_PERCENT}% free (min: ${MIN_FREE_PERCENT}%)"
        return 1
    fi

    log_success "Disk space is adequate: ${FREE_PERCENT}% free"
    return 0
}

# Count backup files
count_backups() {
    log_info "Counting backup files..."

    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | wc -l | tr -d ' ')

    log_info "Total backup files: $BACKUP_COUNT"

    # Calculate total size
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log_info "Total backup size: $TOTAL_SIZE"

    return 0
}

# Send alert notification
send_alert() {
    local status="$1"
    local message="$2"

    log_info "Sending alert: $status - $message"

    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{
                \"text\": \":warning: AgroBridge Backup Alert\",
                \"attachments\": [{
                    \"color\": \"$([ \"$status\" = \"OK\" ] && echo 'good' || echo 'danger')\",
                    \"title\": \"Backup Health Check: ${status}\",
                    \"text\": \"${message}\",
                    \"fields\": [{
                        \"title\": \"Timestamp\",
                        \"value\": \"$(date '+%Y-%m-%d %H:%M:%S UTC')\",
                        \"short\": true
                    }, {
                        \"title\": \"Host\",
                        \"value\": \"$(hostname)\",
                        \"short\": true
                    }],
                    \"footer\": \"AgroBridge Backup Monitor\"
                }]
            }" || log_warn "Failed to send Slack notification"
    fi

    # Email notification (if configured)
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "AgroBridge Backup Alert: $status" "$ALERT_EMAIL" || log_warn "Failed to send email notification"
    fi
}

# Generate health report
generate_health_report() {
    local status="$1"

    cat <<EOF
{
    "check_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "$status",
    "backup_dir": "$BACKUP_DIR",
    "max_age_hours": $MAX_AGE_HOURS,
    "checks": {
        "local_backup": "$LOCAL_STATUS",
        "s3_backup": "$S3_STATUS",
        "backup_size": "$SIZE_STATUS",
        "disk_space": "$DISK_STATUS"
    }
}
EOF
}

# Main execution
main() {
    log_info "=========================================="
    log_info "AgroBridge Backup Health Check"
    log_info "=========================================="

    FAILED=0
    LOCAL_STATUS="passed"
    S3_STATUS="passed"
    SIZE_STATUS="passed"
    DISK_STATUS="passed"

    # Run health checks
    if ! check_local_backup; then
        LOCAL_STATUS="failed"
        FAILED=1
    fi

    if ! check_s3_backup; then
        S3_STATUS="failed"
        # Don't fail overall if S3 is just not configured
        [ -n "$S3_BUCKET" ] && FAILED=1
    fi

    if ! check_backup_size; then
        SIZE_STATUS="failed"
        FAILED=1
    fi

    if ! check_disk_space; then
        DISK_STATUS="warning"
        # Disk space is a warning, not a failure
    fi

    count_backups

    # Generate report
    if [ $FAILED -eq 0 ]; then
        generate_health_report "HEALTHY"
        log_success "=========================================="
        log_success "Backup health check: PASSED"
        log_success "=========================================="
    else
        generate_health_report "UNHEALTHY"
        send_alert "CRITICAL" "Backup health check failed. Please investigate immediately."
        log_error "=========================================="
        log_error "Backup health check: FAILED"
        log_error "=========================================="
        exit 1
    fi
}

# Run main
main "$@"
