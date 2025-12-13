#!/bin/bash
set -e

# ====================================
# AgroBridge Staging Deployment Script
# Enhanced with Rollback Capability
# ====================================

DEPLOY_DIR="/opt/agrobridge-api"
APP_DIR="$DEPLOY_DIR/apps/api"
BACKUP_DIR="$DEPLOY_DIR/releases"
PM2_APP="agrobridge-api-staging"
HEALTH_URL="http://localhost:4000/health"
MAX_HEALTH_RETRIES=10
HEALTH_RETRY_DELAY=3
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"; }
error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"; }

send_notification() {
    local message="$1"
    local color="${2:-good}"
    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\",\"attachments\":[{\"color\":\"$color\"}]}" \
            "$WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
}

health_check() {
    local retries=0
    while [ $retries -lt $MAX_HEALTH_RETRIES ]; do
        if curl -s --fail "$HEALTH_URL" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        log "Health check attempt $retries/$MAX_HEALTH_RETRIES..."
        sleep $HEALTH_RETRY_DELAY
    done
    return 1
}

rollback() {
    local previous_release="$1"
    error "Deployment failed! Rolling back to $previous_release..."
    send_notification "Deployment FAILED - Rolling back to $previous_release" "danger"

    if [ -d "$previous_release" ]; then
        log "Restoring previous release..."
        rm -rf "$APP_DIR/dist"
        cp -r "$previous_release/dist" "$APP_DIR/"

        cd "$APP_DIR"
        pm2 delete "$PM2_APP" 2>/dev/null || true
        pm2 start dist/server.js --name "$PM2_APP" --time

        if health_check; then
            log "Rollback successful!"
            send_notification "Rollback successful - service restored" "warning"
        else
            error "Rollback also failed! Manual intervention required!"
            send_notification "CRITICAL: Rollback FAILED - manual intervention required!" "danger"
            exit 2
        fi
    else
        error "No previous release found for rollback!"
        exit 1
    fi
}

# Main deployment
main() {
    log "Starting Staging Deployment..."
    send_notification "Starting staging deployment on $(hostname)" "warning"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    RELEASE_DIR="$BACKUP_DIR/$TIMESTAMP"

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Find previous release for potential rollback
    PREVIOUS_RELEASE=$(ls -dt "$BACKUP_DIR"/*/ 2>/dev/null | head -1)

    cd "$APP_DIR"

    # Backup current dist before deployment
    if [ -d "dist" ]; then
        log "Backing up current release to $RELEASE_DIR..."
        mkdir -p "$RELEASE_DIR"
        cp -r dist "$RELEASE_DIR/"
        cp package.json "$RELEASE_DIR/" 2>/dev/null || true
        cp package-lock.json "$RELEASE_DIR/" 2>/dev/null || true
    fi

    # Load environment
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi

    # Install dependencies
    log "Installing dependencies..."
    npm ci --legacy-peer-deps 2>&1 || {
        error "npm ci failed"
        rollback "$PREVIOUS_RELEASE"
        exit 1
    }

    # Generate Prisma Client
    log "Generating Prisma Client..."
    npx prisma generate || {
        warn "Prisma generate had issues"
    }

    # Run database migrations
    log "Running database migrations..."
    npx prisma migrate deploy || {
        warn "Migration skipped or failed - continuing"
    }

    # Build application
    log "Building application..."
    npm run build || {
        error "Build failed"
        rollback "$PREVIOUS_RELEASE"
        exit 1
    }

    # Restart PM2
    log "Restarting application..."
    pm2 delete "$PM2_APP" 2>/dev/null || true
    pm2 start dist/server.js --name "$PM2_APP" --time \
        --max-memory-restart 500M \
        --log-date-format "YYYY-MM-DD HH:mm:ss"
    pm2 save

    # Health check
    log "Running health checks..."
    sleep 3
    if health_check; then
        log "Health check passed!"

        # Cleanup old releases (keep last 5)
        cd "$BACKUP_DIR"
        ls -dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf

        log "Deployment completed successfully!"
        send_notification "Staging deployment SUCCESSFUL - $(curl -s $HEALTH_URL | jq -r '.version // \"unknown\"')" "good"
    else
        error "Health check failed after deployment!"
        rollback "$PREVIOUS_RELEASE"
        exit 1
    fi
}

# Handle rollback command
if [ "$1" = "rollback" ]; then
    PREVIOUS_RELEASE=$(ls -dt "$BACKUP_DIR"/*/ 2>/dev/null | head -1)
    if [ -n "$PREVIOUS_RELEASE" ]; then
        rollback "$PREVIOUS_RELEASE"
    else
        error "No releases available for rollback"
        exit 1
    fi
else
    main "$@"
fi
