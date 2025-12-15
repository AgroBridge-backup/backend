#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE API - DOCKER ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════════
# Purpose: Initialize container and wait for dependencies
# Features:
#   - Wait for PostgreSQL to be ready
#   - Wait for Redis to be ready
#   - Run database migrations (production only)
#   - Generate Prisma client
#   - Validate environment
#   - Graceful startup
# ══════════════════════════════════════════════════════════════════════════════

set -e

# ──────────────────────────────────────────────────────────────────────────────
# COLORS & FORMATTING
# ──────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

# Database configuration (parse from DATABASE_URL if not set)
if [ -z "$POSTGRES_HOST" ] && [ -n "$DATABASE_URL" ]; then
    # Extract host from DATABASE_URL (postgresql://user:pass@host:port/db)
    POSTGRES_HOST=$(echo "$DATABASE_URL" | sed -e 's/.*@\([^:]*\).*/\1/')
    POSTGRES_PORT=$(echo "$DATABASE_URL" | sed -e 's/.*:\([0-9]*\)\/.*/\1/')
fi

POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-agrobridge}

REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

# Timeouts
MAX_RETRIES=${MAX_RETRIES:-30}
RETRY_INTERVAL=${RETRY_INTERVAL:-2}

# ──────────────────────────────────────────────────────────────────────────────
# BANNER
# ──────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  AgroBridge API - Container Initialization${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Environment: ${NODE_ENV:-development}"
echo "Database:    ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "Redis:       ${REDIS_HOST}:${REDIS_PORT}"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# WAIT FOR POSTGRESQL
# ──────────────────────────────────────────────────────────────────────────────

wait_for_postgres() {
    log_info "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."

    retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if nc -z "$POSTGRES_HOST" "$POSTGRES_PORT" 2>/dev/null; then
            log_success "PostgreSQL is ready!"
            return 0
        fi

        retries=$((retries + 1))
        log_warn "PostgreSQL not ready yet (attempt $retries/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done

    log_error "PostgreSQL failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# ──────────────────────────────────────────────────────────────────────────────
# WAIT FOR REDIS
# ──────────────────────────────────────────────────────────────────────────────

wait_for_redis() {
    log_info "Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."

    retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
            log_success "Redis is ready!"
            return 0
        fi

        retries=$((retries + 1))
        log_warn "Redis not ready yet (attempt $retries/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done

    log_error "Redis failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# ──────────────────────────────────────────────────────────────────────────────
# RUN MIGRATIONS
# ──────────────────────────────────────────────────────────────────────────────

run_migrations() {
    if [ "$NODE_ENV" = "production" ]; then
        log_info "Running database migrations..."

        if npx prisma migrate deploy --schema=./src/infrastructure/database/prisma/schema.prisma; then
            log_success "Migrations completed successfully"
        else
            log_error "Migration failed!"
            return 1
        fi
    else
        log_info "Skipping migrations in ${NODE_ENV:-development} environment"
    fi
}

# ──────────────────────────────────────────────────────────────────────────────
# GENERATE PRISMA CLIENT
# ──────────────────────────────────────────────────────────────────────────────

generate_prisma() {
    log_info "Checking Prisma client..."

    if [ -d "node_modules/.prisma/client" ]; then
        log_success "Prisma client already generated"
    else
        log_info "Generating Prisma client..."
        if npx prisma generate --schema=./src/infrastructure/database/prisma/schema.prisma; then
            log_success "Prisma client generated"
        else
            log_error "Prisma client generation failed!"
            return 1
        fi
    fi
}

# ──────────────────────────────────────────────────────────────────────────────
# VALIDATE ENVIRONMENT
# ──────────────────────────────────────────────────────────────────────────────

validate_environment() {
    log_info "Validating environment..."

    errors=0

    # Required variables
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL is not set!"
        errors=$((errors + 1))
    fi

    if [ "$NODE_ENV" = "production" ]; then
        # Additional production checks
        if [ -z "$JWT_ACCESS_SECRET" ] && [ -z "$JWT_SECRET" ]; then
            log_error "JWT_ACCESS_SECRET is not set!"
            errors=$((errors + 1))
        fi

        if [ -z "$ENCRYPTION_KEY" ]; then
            log_warn "ENCRYPTION_KEY is not set (may affect some features)"
        fi
    fi

    if [ $errors -gt 0 ]; then
        log_error "Environment validation failed with $errors error(s)"
        return 1
    fi

    log_success "Environment validated"
}

# ──────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────────────────────────

do_health_check() {
    log_info "Performing startup health check..."

    # Check if dist/server.js exists
    if [ ! -f "dist/server.js" ]; then
        log_error "dist/server.js not found! Build may have failed."
        return 1
    fi

    log_success "Health check passed"
}

# ──────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ──────────────────────────────────────────────────────────────────────────────

main() {
    # Skip dependency checks if running a different command
    if [ "$1" = "node" ] || [ "$1" = "npm" ] || [ -z "$1" ]; then

        # Wait for dependencies
        if [ "$SKIP_WAIT_FOR_DEPS" != "true" ]; then
            wait_for_postgres || exit 1
            wait_for_redis || exit 1
        fi

        # Validate environment
        validate_environment || exit 1

        # Generate Prisma client if needed
        generate_prisma || exit 1

        # Run migrations
        if [ "$RUN_MIGRATIONS" = "true" ] || [ "$NODE_ENV" = "production" ]; then
            run_migrations || exit 1
        fi

        # Health check
        do_health_check || exit 1

    fi

    echo ""
    log_success "Initialization complete!"
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Starting AgroBridge API...${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""

    # Execute the main command
    exec "$@"
}

# Run main with all arguments
main "$@"
