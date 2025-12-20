#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# AgroBridge FinTech - Endpoint Testing Script
# Created: 2025-12-20
# Purpose: Test all FinTech endpoints for functionality
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:4000/api/v1}"
AUTH_TOKEN="${AGROBRIDGE_JWT_TOKEN:-}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
    echo -e "${YELLOW}Testing:${NC} $1"
}

print_success() {
    echo -e "${GREEN}  PASS:${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}  FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

test_endpoint() {
    local METHOD=$1
    local ENDPOINT=$2
    local EXPECTED_CODE=$3
    local DESCRIPTION=$4
    local AUTH_REQUIRED=$5

    ((TESTS_RUN++))
    print_test "$DESCRIPTION"

    local HEADERS=""
    if [ "$AUTH_REQUIRED" = "true" ] && [ -n "$AUTH_TOKEN" ]; then
        HEADERS="-H \"Authorization: Bearer $AUTH_TOKEN\""
    fi

    local RESPONSE_CODE=$(eval curl -s -o /dev/null -w "%{http_code}" -X $METHOD $HEADERS "$BASE_URL$ENDPOINT" 2>/dev/null)

    if [ "$RESPONSE_CODE" = "$EXPECTED_CODE" ]; then
        print_success "$METHOD $ENDPOINT -> $RESPONSE_CODE"
    else
        print_fail "$METHOD $ENDPOINT -> $RESPONSE_CODE (expected $EXPECTED_CODE)"
    fi

    if [ "$VERBOSE" = "true" ]; then
        echo -e "  ${BLUE}Response:${NC}"
        eval curl -s -X $METHOD $HEADERS "$BASE_URL$ENDPOINT" | jq '.' 2>/dev/null || echo "  (Not JSON)"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN TEST SUITE
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${GREEN}"
cat << "EOF"
   ___                ___       _     _
  / _ \              / __\ _ __(_) __| | __ _  ___
 / /_\/_ __ ___     /__\// '__| |/ _` |/ _` |/ _ \
/ /_\\| '__/ _ \   / \/  \ |  | | (_| | (_| |  __/
\____/|_|  \___/   \_____/_|  |_|\__,_|\__, |\___|
                                        |___/
   FinTech API Testing Suite v2.0.0
EOF
echo -e "${NC}"

print_header "Test Configuration"
echo "Base URL: $BASE_URL"
echo "Auth Token: ${AUTH_TOKEN:0:20}... (${#AUTH_TOKEN} chars)"
echo "Verbose Mode: $VERBOSE"
echo ""

# Check if server is running
if ! curl -s "$BASE_URL/../health" > /dev/null 2>&1; then
    echo -e "${YELLOW}Note: Server may not be running at $BASE_URL${NC}"
    echo "Start server with: npm run dev"
    echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════
# 1. HEALTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

print_header "1. Health Endpoints"

test_endpoint "GET" "/fintech/health" "200" "FinTech health check" "false"

# ═══════════════════════════════════════════════════════════════════════════
# 2. WHATSAPP BOT ENDPOINTS (4 tests)
# ═══════════════════════════════════════════════════════════════════════════

print_header "2. WhatsApp Bot Module (4 endpoints)"

test_endpoint "GET" "/webhook/whatsapp" "403" "Webhook verification (no params)" "false"
test_endpoint "POST" "/webhook/whatsapp" "200" "Webhook message receiver" "false"
test_endpoint "GET" "/webhook/whatsapp/health" "200" "Bot health check" "false"
test_endpoint "POST" "/webhook/whatsapp/test" "401" "Send test message (auth required)" "true"

# ═══════════════════════════════════════════════════════════════════════════
# 3. COLLECTIONS ENDPOINTS (6 tests)
# ═══════════════════════════════════════════════════════════════════════════

print_header "3. Collections Module (6 endpoints)"

test_endpoint "GET" "/collections/health" "200" "Collections health check" "false"
test_endpoint "GET" "/collections/rules" "200" "Collection rules" "false"
test_endpoint "GET" "/collections/targets" "200" "Collection targets" "false"
test_endpoint "POST" "/collections/run" "200" "Manual collection run" "false"
test_endpoint "GET" "/collections/late-fee/test-uuid" "200" "Calculate late fee" "false"
test_endpoint "POST" "/collections/trigger/test-uuid" "404" "Trigger collection for advance" "false"

# ═══════════════════════════════════════════════════════════════════════════
# 4. CREDIT SCORING ENDPOINTS (5 tests)
# ═══════════════════════════════════════════════════════════════════════════

print_header "4. Credit Scoring Module (5 endpoints)"

test_endpoint "GET" "/credit/health" "200" "Credit scoring health check" "false"
test_endpoint "GET" "/credit/factors" "200" "Score factors documentation" "false"
test_endpoint "GET" "/credit/score/test-uuid" "500" "Calculate credit score (no user)" "false"
test_endpoint "GET" "/credit/eligibility/test-uuid" "500" "Check eligibility (no user)" "false"
test_endpoint "POST" "/credit/calculate/test-uuid" "500" "Force recalculation (no user)" "false"

# ═══════════════════════════════════════════════════════════════════════════
# 5. REPAYMENTS ENDPOINTS (9 tests)
# ═══════════════════════════════════════════════════════════════════════════

print_header "5. Repayments Module (9 endpoints)"

test_endpoint "GET" "/repayments/health" "200" "Repayments health check" "false"
test_endpoint "GET" "/repayments/aging-report" "200" "AR aging report" "false"
test_endpoint "GET" "/repayments/test-uuid/balance" "500" "Get balance (no advance)" "false"
test_endpoint "GET" "/repayments/test-uuid/schedule" "500" "Payment schedule (no advance)" "false"
test_endpoint "GET" "/repayments/test-uuid/history" "500" "Payment history (no advance)" "false"
test_endpoint "POST" "/repayments/test-uuid" "400" "Record payment (no body)" "false"
test_endpoint "PATCH" "/repayments/test-uuid/extend" "400" "Extend due date (no body)" "false"
test_endpoint "POST" "/repayments/webhook/stripe" "200" "Stripe webhook" "false"
test_endpoint "POST" "/repayments/webhook/mercadopago" "200" "MercadoPago webhook" "false"

# ═══════════════════════════════════════════════════════════════════════════
# TEST SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

print_header "Test Results Summary"

echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}\n"
    exit 0
else
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($TESTS_PASSED/$TESTS_RUN)*100}")
    echo -e "\n${YELLOW}Success rate: $SUCCESS_RATE%${NC}"
    echo -e "${YELLOW}Some tests failed - review output above${NC}\n"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# USAGE EXAMPLES
# ═══════════════════════════════════════════════════════════════════════════

: << 'USAGE'

Basic usage:
  ./test-fintech-endpoints.sh

With authentication:
  export AGROBRIDGE_JWT_TOKEN="your_jwt_token_here"
  ./test-fintech-endpoints.sh

Verbose mode (show responses):
  VERBOSE=true ./test-fintech-endpoints.sh

Custom API URL:
  API_BASE_URL="https://api.agrobridge.io/api/v1" ./test-fintech-endpoints.sh

All options:
  API_BASE_URL="https://api.agrobridge.io/api/v1" \
  AGROBRIDGE_JWT_TOKEN="eyJhbGci..." \
  VERBOSE=true \
  ./test-fintech-endpoints.sh

USAGE
