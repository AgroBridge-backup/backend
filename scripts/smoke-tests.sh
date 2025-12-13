#!/bin/bash
set -e

ENVIRONMENT=${1:-staging}

if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://api.agrobridge.io"
else
    BASE_URL="https://api-staging.agrobridge.io"
fi

echo "🧪 Running smoke tests for $ENVIRONMENT environment..."
echo "🔗 Base URL: $BASE_URL"

# Test 1: Health Check
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (HTTP $HEALTH_RESPONSE)"
    exit 1
fi

# Test 2: API responsiveness
echo "Testing API responsiveness..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health" || echo "999")
echo "⏱️  Response time: ${RESPONSE_TIME}s"

if [ $(echo "$RESPONSE_TIME < 5.0" | bc -l) -eq 1 ]; then
    echo "✅ Response time acceptable"
else
    echo "⚠️  Response time slow (>${RESPONSE_TIME}s)"
fi

echo "✅ All smoke tests passed for $ENVIRONMENT!"
