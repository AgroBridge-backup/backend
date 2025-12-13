#!/bin/bash
set -e

# ====================================
# AgroBridge Extended Smoke Tests
# Comprehensive health validation
# ====================================

ENVIRONMENT=${1:-staging}
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
FAILED_TESTS=0
TOTAL_TESTS=0

if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://api.agrobridge.io"
else
    BASE_URL="https://api-staging.agrobridge.io"
fi

echo "🧪 Running extended smoke tests against $BASE_URL..."
echo "=================================================="

# Helper function for running tests
run_test() {
    local test_name="$1"
    local url="$2"
    local expected_status="$3"
    local check_body="$4"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "

    RESPONSE=$(curl -s -w "\n%{http_code}" "$url" 2>&1 || echo -e "\n000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" != "$expected_status" ]; then
        echo "❌ FAILED (Expected $expected_status, got $HTTP_CODE)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi

    # Extra body validation if provided
    if [ -n "$check_body" ]; then
        if ! echo "$BODY" | grep -q "$check_body"; then
            echo "❌ FAILED (Body doesn't contain '$check_body')"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi

    echo "✅ PASSED"
    return 0
}

# Test 1: Health endpoint
run_test "Health Check" "$BASE_URL/health" "200" "healthy"

# Test 2: Health response structure
echo -n "Testing: Health Response Structure... "
HEALTH_BODY=$(curl -s "$BASE_URL/health" 2>/dev/null)
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if echo "$HEALTH_BODY" | jq -e '.status, .environment, .version' > /dev/null 2>&1; then
    echo "✅ PASSED"
else
    echo "❌ FAILED (Missing required fields)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 3: API Root endpoint
run_test "API Root" "$BASE_URL/api/v1" "200" || run_test "API Root (alt)" "$BASE_URL/" "200" || true

# Test 4: Auth Protection (should return 401 without credentials)
echo -n "Testing: Auth Protection... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/me" 2>/dev/null || echo "000")
if [ "$AUTH_CODE" = "401" ] || [ "$AUTH_CODE" = "403" ] || [ "$AUTH_CODE" = "404" ]; then
    echo "✅ PASSED (HTTP $AUTH_CODE)"
else
    echo "❌ FAILED (Expected 401/403/404, got $AUTH_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 5: SSL Certificate (only for HTTPS)
if [[ "$BASE_URL" == https* ]]; then
    echo -n "Testing: SSL Certificate... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    HOST=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
    SSL_RESULT=$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    if [ $? -eq 0 ]; then
        # Check if cert expires in more than 7 days
        EXPIRY=$(echo "$SSL_RESULT" | grep "notAfter" | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null || echo "0")
        NOW_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
        if [ "$DAYS_LEFT" -gt 7 ]; then
            echo "✅ PASSED ($DAYS_LEFT days remaining)"
        else
            echo "⚠️ WARNING ($DAYS_LEFT days until expiry)"
        fi
    else
        echo "❌ FAILED (SSL check failed)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi

# Test 6: Response Time
echo -n "Testing: Response Time... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
START_TIME=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")
curl -s "$BASE_URL/health" > /dev/null
END_TIME=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")
RESPONSE_TIME=$((END_TIME - START_TIME))

if [ "$RESPONSE_TIME" -lt 500 ]; then
    echo "✅ PASSED (${RESPONSE_TIME}ms)"
elif [ "$RESPONSE_TIME" -lt 1000 ]; then
    echo "⚠️ WARNING (${RESPONSE_TIME}ms - acceptable but slow)"
else
    echo "❌ FAILED (${RESPONSE_TIME}ms > 1000ms)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 7: Content-Type header
echo -n "Testing: Content-Type Header... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
CONTENT_TYPE=$(curl -s -I "$BASE_URL/health" 2>/dev/null | grep -i "content-type" | tr -d '\r')
if echo "$CONTENT_TYPE" | grep -qi "application/json"; then
    echo "✅ PASSED"
else
    echo "⚠️ WARNING (Expected application/json)"
fi

# Test 8: CORS Headers
echo -n "Testing: CORS Headers... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
CORS_HEADERS=$(curl -s -I -H "Origin: https://app.agrobridge.io" "$BASE_URL/health" 2>/dev/null | grep -i "access-control")
if [ -n "$CORS_HEADERS" ]; then
    echo "✅ PASSED"
else
    echo "⚠️ INFO (CORS headers not present for this origin)"
fi

# Summary
echo ""
echo "=================================================="
echo "📊 RESULTS: $((TOTAL_TESTS - FAILED_TESTS))/$TOTAL_TESTS tests passed"
echo "=================================================="

if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ All smoke tests passed for $ENVIRONMENT"

    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ All smoke tests PASSED on $ENVIRONMENT\",\"attachments\":[{\"color\":\"good\",\"text\":\"$((TOTAL_TESTS - FAILED_TESTS))/$TOTAL_TESTS tests passed\"}]}" \
            "$WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    exit 0
else
    echo "❌ $FAILED_TESTS test(s) failed on $ENVIRONMENT"

    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"❌ Smoke tests FAILED on $ENVIRONMENT\",\"attachments\":[{\"color\":\"danger\",\"text\":\"$FAILED_TESTS/$TOTAL_TESTS tests failed\"}]}" \
            "$WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    exit 1
fi
