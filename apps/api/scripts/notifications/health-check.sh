#!/bin/bash
#
# health-check.sh
# Check notification system health
#
# Usage: ./scripts/notifications/health-check.sh [api-url]
# Example: ./scripts/notifications/health-check.sh https://api.agrobridge.io
#

set -e

API_URL=${1:-http://localhost:3000}
AUTH_TOKEN=${ADMIN_AUTH_TOKEN:-""}

echo "=========================================="
echo "Notification System Health Check"
echo "API URL: ${API_URL}"
echo "=========================================="

# Check API health
echo ""
echo "1. Checking API health..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/status")
if [ "$API_STATUS" = "200" ]; then
    echo "   ✅ API is healthy"
else
    echo "   ❌ API is unhealthy (status: ${API_STATUS})"
fi

# Check Redis connection (via queue stats)
echo ""
echo "2. Checking queue status..."
if [ -n "$AUTH_TOKEN" ]; then
    QUEUE_RESPONSE=$(curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" "${API_URL}/api/v1/notifications/queue/stats" 2>/dev/null || echo "{}")

    if echo "$QUEUE_RESPONSE" | grep -q "waiting"; then
        WAITING=$(echo "$QUEUE_RESPONSE" | jq -r '.waiting // 0')
        ACTIVE=$(echo "$QUEUE_RESPONSE" | jq -r '.active // 0')
        FAILED=$(echo "$QUEUE_RESPONSE" | jq -r '.failed // 0')

        echo "   ✅ Queue is accessible"
        echo "   - Waiting: ${WAITING}"
        echo "   - Active: ${ACTIVE}"
        echo "   - Failed: ${FAILED}"

        if [ "$WAITING" -gt 10000 ]; then
            echo "   ⚠️  Warning: High queue depth"
        fi
    else
        echo "   ❌ Queue is not accessible"
    fi
else
    echo "   ⚠️  Skipped (no auth token)"
fi

# Check Bull Board dashboard
echo ""
echo "3. Checking Bull Board dashboard..."
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/admin/queues")
if [ "$DASHBOARD_STATUS" = "200" ] || [ "$DASHBOARD_STATUS" = "302" ]; then
    echo "   ✅ Dashboard is accessible"
else
    echo "   ⚠️  Dashboard returned status: ${DASHBOARD_STATUS}"
fi

# Check database connection
echo ""
echo "4. Checking database (via notifications endpoint)..."
if [ -n "$AUTH_TOKEN" ]; then
    DB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${AUTH_TOKEN}" "${API_URL}/api/v1/notifications?limit=1")
    if [ "$DB_STATUS" = "200" ]; then
        echo "   ✅ Database is accessible"
    else
        echo "   ❌ Database check failed (status: ${DB_STATUS})"
    fi
else
    echo "   ⚠️  Skipped (no auth token)"
fi

# Summary
echo ""
echo "=========================================="
echo "Health Check Complete"
echo ""
echo "For full health metrics, access:"
echo "  ${API_URL}/admin/queues"
echo "=========================================="
