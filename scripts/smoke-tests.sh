#!/bin/bash
set -e

ENVIRONMENT=${1:-staging}
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://api.agrobridge.io"
else
    BASE_URL="https://api-staging.agrobridge.io"
fi

echo "🧪 Running smoke tests against $BASE_URL..."

# Test 1: Health endpoint with response body
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" != "200" ]; then
  ERROR_MSG="❌ CRITICAL: Health check failed for $ENVIRONMENT! HTTP $HTTP_CODE"
  echo "$ERROR_MSG"

  if [ -n "$WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$ERROR_MSG\",\"attachments\":[{\"color\":\"danger\",\"text\":\"Response: $BODY\"}]}" \
      "$WEBHOOK_URL" 2>/dev/null || true
  fi
  exit 1
fi

echo "✅ Health check passed: $BODY"

# Test 2: Database connectivity (check health response)
DB_STATUS=$(echo "$BODY" | jq -r '.database // "unknown"' 2>/dev/null || echo "unknown")
if [ "$DB_STATUS" = "disconnected" ] || [ "$DB_STATUS" = "error" ]; then
  ERROR_MSG="❌ CRITICAL: Database not connected on $ENVIRONMENT! Status: $DB_STATUS"
  echo "$ERROR_MSG"

  if [ -n "$WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$ERROR_MSG\",\"attachments\":[{\"color\":\"danger\"}]}" \
      "$WEBHOOK_URL" 2>/dev/null || true
  fi
  exit 1
fi

# Test 3: API responsiveness
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health" || echo "999")
echo "⏱️  Response time: ${RESPONSE_TIME}s"

# Convert to integer for comparison (multiply by 100 to avoid decimals)
RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)
if [ "$RESPONSE_MS" -gt 5000 ]; then
  WARN_MSG="⚠️ WARNING: Slow response time on $ENVIRONMENT: ${RESPONSE_TIME}s"
  echo "$WARN_MSG"

  if [ -n "$WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$WARN_MSG\",\"attachments\":[{\"color\":\"warning\"}]}" \
      "$WEBHOOK_URL" 2>/dev/null || true
  fi
fi

echo "✅ All smoke tests passed for $ENVIRONMENT"
exit 0
