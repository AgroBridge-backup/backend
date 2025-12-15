#!/bin/bash

# =============================================================================
# AgroBridge Production Validation Script
# Pre-deployment and post-deployment validation
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-https://api.agrobridgeint.com}"
HEALTH_ENDPOINT="${API_URL}/health"
READY_ENDPOINT="${API_URL}/health/ready"
LIVE_ENDPOINT="${API_URL}/health/live"
DOCS_ENDPOINT="${API_URL}/api-docs"

# Counters
PASSED=0
FAILED=0

# Functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((FAILED++))
}

# =============================================================================
# Pre-Deployment Validation
# =============================================================================

pre_deployment() {
    print_header "Pre-Deployment Validation"

    print_section "Build Verification"

    # Check if dist folder exists and has content
    if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
        check_pass "Build output exists in dist/"
    else
        check_fail "Build output missing - run 'npm run build'"
    fi

    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        check_pass "Dependencies installed"
    else
        check_fail "Dependencies not installed - run 'npm install'"
    fi

    print_section "Environment Configuration"

    # Required environment variables
    REQUIRED_VARS=(
        "DATABASE_URL"
        "JWT_ACCESS_SECRET"
        "JWT_REFRESH_SECRET"
        "ENCRYPTION_KEY"
        "NODE_ENV"
    )

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -n "${!var}" ]; then
            check_pass "$var is configured"
        else
            check_fail "$var is not set"
        fi
    done

    print_section "Database Connection"

    # Test database connection
    if command -v npx &> /dev/null; then
        if npx prisma db execute --stdin <<< "SELECT 1" &>/dev/null; then
            check_pass "Database connection successful"
        else
            check_fail "Database connection failed"
        fi
    fi

    print_section "TypeScript Compilation"

    # Check TypeScript compilation
    if npx tsc --noEmit &>/dev/null; then
        check_pass "TypeScript compiles without errors"
    else
        check_fail "TypeScript compilation errors detected"
    fi

    print_section "Test Suite"

    # Run tests
    if npm test -- --passWithNoTests &>/dev/null; then
        check_pass "All tests passing"
    else
        check_fail "Tests failing"
    fi
}

# =============================================================================
# Post-Deployment Validation
# =============================================================================

post_deployment() {
    print_header "Post-Deployment Validation"

    print_section "Health Checks"

    # Health endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        check_pass "Health endpoint responding (HTTP $HTTP_CODE)"
    else
        check_fail "Health endpoint not responding (HTTP $HTTP_CODE)"
    fi

    # Readiness endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$READY_ENDPOINT" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        check_pass "Readiness endpoint responding (HTTP $HTTP_CODE)"
    else
        check_fail "Readiness endpoint not responding (HTTP $HTTP_CODE)"
    fi

    # Liveness endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_ENDPOINT" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        check_pass "Liveness endpoint responding (HTTP $HTTP_CODE)"
    else
        check_fail "Liveness endpoint not responding (HTTP $HTTP_CODE)"
    fi

    print_section "API Documentation"

    # Swagger/API docs
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOCS_ENDPOINT" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        check_pass "API documentation accessible (HTTP $HTTP_CODE)"
    else
        check_fail "API documentation not accessible (HTTP $HTTP_CODE)"
    fi

    print_section "Security Headers"

    HEADERS=$(curl -sI "$HEALTH_ENDPOINT" 2>/dev/null || true)

    if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
        check_pass "X-Content-Type-Options header present"
    else
        check_fail "X-Content-Type-Options header missing"
    fi

    if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
        check_pass "X-Frame-Options header present"
    else
        check_fail "X-Frame-Options header missing"
    fi

    if echo "$HEADERS" | grep -qi "X-XSS-Protection"; then
        check_pass "X-XSS-Protection header present"
    else
        check_fail "X-XSS-Protection header missing"
    fi

    print_section "Response Time"

    # Measure response time
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$HEALTH_ENDPOINT" 2>/dev/null || echo "999")
    RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc 2>/dev/null || echo "999000")

    if (( $(echo "$RESPONSE_TIME < 1" | bc -l 2>/dev/null || echo 0) )); then
        check_pass "Response time: ${RESPONSE_MS%.*}ms (< 1000ms)"
    else
        check_fail "Response time: ${RESPONSE_MS%.*}ms (> 1000ms)"
    fi

    print_section "SSL Certificate"

    if [[ "$API_URL" == https://* ]]; then
        DOMAIN=$(echo "$API_URL" | sed 's|https://||' | sed 's|/.*||')
        CERT_INFO=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || true)

        if [ -n "$CERT_INFO" ]; then
            check_pass "SSL certificate is valid"
        else
            check_fail "SSL certificate check failed"
        fi
    else
        check_fail "Not using HTTPS"
    fi

    print_section "API Endpoint Smoke Test"

    # Test authentication endpoint (should return 400 for invalid request, not 500)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/v1/auth/login" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
        check_pass "Auth endpoint responding correctly (HTTP $HTTP_CODE for invalid request)"
    elif [ "$HTTP_CODE" = "500" ]; then
        check_fail "Auth endpoint returning server error (HTTP 500)"
    else
        check_fail "Auth endpoint unexpected response (HTTP $HTTP_CODE)"
    fi
}

# =============================================================================
# Full Validation
# =============================================================================

full_validation() {
    pre_deployment
    post_deployment
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    print_header "Validation Summary"

    TOTAL=$((PASSED + FAILED))

    echo -e "  ${GREEN}Passed: $PASSED${NC}"
    echo -e "  ${RED}Failed: $FAILED${NC}"
    echo -e "  Total:  $TOTAL"
    echo ""

    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  VALIDATION FAILED - $FAILED issues found${NC}"
        echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
        return 1
    else
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  VALIDATION PASSED - All checks successful${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
        return 0
    fi
}

# =============================================================================
# Main
# =============================================================================

print_header "AgroBridge Production Validation"
echo "Started at: $(date)"
echo "API URL: $API_URL"

case "${1:-full}" in
    pre)
        pre_deployment
        ;;
    post)
        post_deployment
        ;;
    full)
        full_validation
        ;;
    *)
        echo "Usage: $0 [pre|post|full]"
        echo "  pre  - Run pre-deployment checks"
        echo "  post - Run post-deployment checks"
        echo "  full - Run all checks (default)"
        exit 1
        ;;
esac

print_summary
