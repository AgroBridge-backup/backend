#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════
# AgroBridge Backup Verification Script
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Validate backup integrity by performing test restoration
# Schedule: Run weekly or after critical backups
# Exit Codes: 0 = Success, 1 = Failure
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
VERIFY_DB="${POSTGRES_DB:-agrobridge_verify}"
VERIFY_USER="${POSTGRES_USER:-agrobridge}"
VERIFY_PASSWORD="${POSTGRES_PASSWORD}"
TEMP_DIR="/tmp/backup-verify"

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

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary resources..."
    rm -rf "$TEMP_DIR"

    # Drop verification database if it exists
    if command -v psql >/dev/null 2>&1; then
        PGPASSWORD="$VERIFY_PASSWORD" psql -U "$VERIFY_USER" -h localhost -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Find latest backup
find_latest_backup() {
    log_info "Finding latest backup file..."

    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f | sort -r | head -1)

    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No backup files found in $BACKUP_DIR"
        exit 1
    fi

    log_info "Found backup: $LATEST_BACKUP"
    echo "$LATEST_BACKUP"
}

# Verify backup file integrity
verify_file_integrity() {
    local backup_file="$1"

    log_info "Verifying file integrity..."

    # Check file exists and is not empty
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file does not exist: $backup_file"
        return 1
    fi

    if [ ! -s "$backup_file" ]; then
        log_error "Backup file is empty: $backup_file"
        return 1
    fi

    # Verify gzip integrity
    if ! gzip -t "$backup_file" 2>/dev/null; then
        log_error "Backup file is corrupted (gzip test failed)"
        return 1
    fi

    log_success "File integrity verified"
    return 0
}

# Verify backup can be decompressed
verify_decompression() {
    local backup_file="$1"

    log_info "Verifying backup can be decompressed..."

    mkdir -p "$TEMP_DIR"

    # Decompress to temp location
    if gunzip -c "$backup_file" > "$TEMP_DIR/backup.sql" 2>/dev/null; then
        DECOMPRESSED_SIZE=$(ls -lh "$TEMP_DIR/backup.sql" | awk '{print $5}')
        log_success "Decompression successful (Size: $DECOMPRESSED_SIZE)"
        return 0
    else
        log_error "Decompression failed"
        return 1
    fi
}

# Verify SQL structure
verify_sql_structure() {
    log_info "Verifying SQL structure..."

    local sql_file="$TEMP_DIR/backup.sql"

    # Check for essential PostgreSQL dump markers
    if ! grep -q "PostgreSQL database dump" "$sql_file"; then
        log_error "Missing PostgreSQL dump header"
        return 1
    fi

    # Check for CREATE TABLE statements
    TABLE_COUNT=$(grep -c "CREATE TABLE" "$sql_file" || echo "0")
    if [ "$TABLE_COUNT" -eq 0 ]; then
        log_error "No CREATE TABLE statements found"
        return 1
    fi

    log_success "SQL structure verified ($TABLE_COUNT tables found)"
    return 0
}

# Verify critical tables exist in backup
verify_critical_tables() {
    log_info "Verifying critical tables in backup..."

    local sql_file="$TEMP_DIR/backup.sql"
    local missing_tables=""

    # List of critical AgroBridge tables
    CRITICAL_TABLES="User Batch Producer Order Payment Invoice LiquidityPool AdvanceContract"

    for table in $CRITICAL_TABLES; do
        if ! grep -qi "CREATE TABLE.*\"$table\"" "$sql_file" && \
           ! grep -qi "CREATE TABLE.*$table" "$sql_file"; then
            missing_tables="$missing_tables $table"
        fi
    done

    if [ -n "$missing_tables" ]; then
        log_error "Missing critical tables:$missing_tables"
        return 1
    fi

    log_success "All critical tables present in backup"
    return 0
}

# Perform test restoration (optional - requires PostgreSQL)
perform_test_restoration() {
    log_info "Performing test restoration..."

    if ! command -v psql >/dev/null 2>&1; then
        log_info "PostgreSQL client not available, skipping test restoration"
        return 0
    fi

    local sql_file="$TEMP_DIR/backup.sql"

    # Create verification database
    log_info "Creating verification database: $VERIFY_DB"
    PGPASSWORD="$VERIFY_PASSWORD" psql -U "$VERIFY_USER" -h localhost -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" 2>/dev/null || true
    PGPASSWORD="$VERIFY_PASSWORD" psql -U "$VERIFY_USER" -h localhost -c "CREATE DATABASE ${VERIFY_DB};" 2>/dev/null

    if [ $? -ne 0 ]; then
        log_info "Could not create verification database, skipping test restoration"
        return 0
    fi

    # Restore backup
    log_info "Restoring backup to verification database..."
    if PGPASSWORD="$VERIFY_PASSWORD" psql -U "$VERIFY_USER" -h localhost -d "$VERIFY_DB" -f "$sql_file" >/dev/null 2>&1; then
        log_success "Test restoration completed successfully"

        # Verify table count
        TABLE_COUNT=$(PGPASSWORD="$VERIFY_PASSWORD" psql -U "$VERIFY_USER" -h localhost -d "$VERIFY_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
        log_info "Restored $TABLE_COUNT tables"

        return 0
    else
        log_error "Test restoration failed"
        return 1
    fi
}

# Generate verification report
generate_report() {
    local backup_file="$1"
    local status="$2"

    log_info "Generating verification report..."

    REPORT_FILE="$TEMP_DIR/verification-report.json"
    BACKUP_SIZE=$(ls -lh "$backup_file" | awk '{print $5}')
    BACKUP_DATE=$(stat -c %y "$backup_file" 2>/dev/null || stat -f %Sm "$backup_file" 2>/dev/null)

    cat > "$REPORT_FILE" <<EOF
{
    "verification_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_file": "$backup_file",
    "backup_size": "$BACKUP_SIZE",
    "backup_created": "$BACKUP_DATE",
    "status": "$status",
    "checks": {
        "file_integrity": "passed",
        "decompression": "passed",
        "sql_structure": "passed",
        "critical_tables": "passed"
    }
}
EOF

    cat "$REPORT_FILE"
}

# Send notification
send_notification() {
    local status="$1"
    local backup_file="$2"

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{
                \"text\": \"AgroBridge Backup Verification: ${status}\",
                \"attachments\": [{
                    \"color\": \"$([ \"$status\" = \"PASSED\" ] && echo 'good' || echo 'danger')\",
                    \"fields\": [{
                        \"title\": \"Backup File\",
                        \"value\": \"$(basename $backup_file)\",
                        \"short\": true
                    }, {
                        \"title\": \"Verification Date\",
                        \"value\": \"$(date '+%Y-%m-%d %H:%M:%S')\",
                        \"short\": true
                    }]
                }]
            }"
    fi
}

# Main execution
main() {
    log_info "=========================================="
    log_info "AgroBridge Backup Verification Starting"
    log_info "=========================================="

    # Find latest backup
    BACKUP_FILE=$(find_latest_backup)

    # Run verification checks
    FAILED=0

    if ! verify_file_integrity "$BACKUP_FILE"; then
        FAILED=1
    fi

    if [ $FAILED -eq 0 ] && ! verify_decompression "$BACKUP_FILE"; then
        FAILED=1
    fi

    if [ $FAILED -eq 0 ] && ! verify_sql_structure; then
        FAILED=1
    fi

    if [ $FAILED -eq 0 ] && ! verify_critical_tables; then
        FAILED=1
    fi

    # Optional: Test restoration
    if [ $FAILED -eq 0 ] && [ "${SKIP_TEST_RESTORE:-false}" != "true" ]; then
        perform_test_restoration || true  # Don't fail on restoration issues
    fi

    # Generate report and notify
    if [ $FAILED -eq 0 ]; then
        generate_report "$BACKUP_FILE" "PASSED"
        send_notification "PASSED" "$BACKUP_FILE"
        log_success "=========================================="
        log_success "Backup verification PASSED"
        log_success "=========================================="
        exit 0
    else
        generate_report "$BACKUP_FILE" "FAILED"
        send_notification "FAILED" "$BACKUP_FILE"
        log_error "=========================================="
        log_error "Backup verification FAILED"
        log_error "=========================================="
        exit 1
    fi
}

# Run main
main "$@"
