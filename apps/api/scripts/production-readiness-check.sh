#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE PRODUCTION READINESS CHECK (Quick Mode)
# ═══════════════════════════════════════════════════════════════════════════════
# Run this script before deploying to production to verify all requirements are met.
# Usage: ./scripts/production-readiness-check.sh
# ═══════════════════════════════════════════════════════════════════════════════

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

check() {
    local name="$1"
    local condition="$2"
    local fail_msg="$3"

    printf "  ➤ %-50s" "$name..."

    if eval "$condition"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        [ -n "$fail_msg" ] && echo -e "    ${RED}↳ $fail_msg${NC}"
        ((FAILED++))
    fi
}

warn_check() {
    local name="$1"
    local condition="$2"
    local warn_msg="$3"

    printf "  ➤ %-50s" "$name..."

    if eval "$condition"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ WARN${NC}"
        [ -n "$warn_msg" ] && echo -e "    ${YELLOW}↳ $warn_msg${NC}"
        ((WARNINGS++))
    fi
}

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           AGROBRIDGE API - PRODUCTION READINESS CHECK                         ║${NC}"
echo -e "${BLUE}║                     $(date '+%Y-%m-%d %H:%M:%S')                              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  1. CODE QUALITY${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

check "TypeScript configuration" "[ -f tsconfig.json ]" "tsconfig.json not found"
warn_check "ESLint configuration" "[ -f .eslintrc.js ] || [ -f .eslintrc.json ] || [ -f eslint.config.js ] || grep -q eslint package.json" "ESLint not configured"
check "Package lock file" "[ -f package-lock.json ]" "package-lock.json not found"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  2. SECURITY${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

check "Environment example" "[ -f .env.example ]" ".env.example not found"
check "Rate limiter module" "[ -f src/infrastructure/security/rate-limiter.ts ]" "Rate limiter not found"
check "Input sanitizer" "[ -f src/infrastructure/security/input-sanitizer.ts ]" "Input sanitizer not found"
check "Audit logger" "[ -f src/infrastructure/security/audit-logger.ts ]" "Audit logger not found"
check "Encryption service" "[ -f src/infrastructure/security/encryption.service.ts ]" "Encryption service not found"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  3. DATABASE${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

check "Prisma schema" "[ -f src/infrastructure/database/prisma/schema.prisma ]" "Prisma schema not found"
check "Database indexes" "[ -f src/infrastructure/database/prisma/migrations/optimize_indexes.sql ]" "Index optimization not found"
check "Connection config" "[ -f src/infrastructure/database/connection-config.ts ]" "Connection config not found"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  4. TESTING${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

UNIT_TESTS=$(find tests/unit -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' ')
check "Unit tests (min 20)" "[ $UNIT_TESTS -ge 20 ]" "Only $UNIT_TESTS unit tests found"

INT_TESTS=$(find tests/integration -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' ')
warn_check "Integration tests (min 5)" "[ $INT_TESTS -ge 5 ]" "Only $INT_TESTS integration tests found"

check "k6 load tests" "[ -f tests/load/k6-load-test.js ]" "k6 load tests not found"
check "k6 stress tests" "[ -f tests/load/k6-stress-test.js ]" "k6 stress tests not found"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  5. MONITORING & OBSERVABILITY${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

check "Sentry integration" "[ -f src/infrastructure/monitoring/sentry.ts ]" "Sentry not configured"
check "Logger module" "[ -f src/shared/utils/logger.ts ] || [ -f src/infrastructure/logging/logger.ts ]" "Logger not found"
check "Request context" "[ -f src/infrastructure/context/request-context.ts ]" "Request context not found"
check "Health routes" "[ -f src/presentation/routes/health.routes.ts ]" "Health routes not found"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  6. DOCUMENTATION${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

check "Swagger configuration" "grep -q swagger-ui-express package.json 2>/dev/null" "Swagger not configured"
warn_check "Docker compose" "[ -f docker-compose.yml ]" "docker-compose.yml not found"
warn_check "Nginx config" "[ -f nginx/nginx.conf ]" "Nginx config not found"

# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}  7. DEPLOYMENT${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────${NC}"

check "Environment validation" "[ -f src/config/env.ts ]" "Environment validation not found"
check "App entry point" "[ -f src/app.ts ]" "App entry point not found"
check "Server entry point" "[ -f src/server.ts ] || [ -f src/index.ts ]" "Server entry not found"

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✓ Passed:   $PASSED${NC}"
echo -e "  ${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo -e "  ${RED}✗ Failed:   $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))
if [ "$TOTAL" -gt 0 ]; then
    SCORE=$((PASSED * 100 / TOTAL))
else
    SCORE=0
fi

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}  ★ PRODUCTION READY - Score: ${SCORE}%${NC}"
    echo ""
    exit 0
elif [ "$FAILED" -le 3 ]; then
    echo -e "${YELLOW}  ⚠ ALMOST READY - Score: ${SCORE}% - Fix $FAILED issues before deploying${NC}"
    echo ""
    exit 1
else
    echo -e "${RED}  ✗ NOT READY - Score: ${SCORE}% - $FAILED critical issues need attention${NC}"
    echo ""
    exit 2
fi
