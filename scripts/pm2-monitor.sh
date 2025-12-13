#!/bin/bash

# PM2 Monitoring Script with Alerts
# Checks CPU and memory usage and sends alerts if thresholds are exceeded

# Configuration
WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
THRESHOLD_CPU=70
THRESHOLD_MEM=80
LOG_FILE="/var/log/pm2-monitor.log"

# Get PM2 metrics in JSON format
PM2_JSON=$(pm2 jlist 2>/dev/null)

if [ -z "$PM2_JSON" ] || [ "$PM2_JSON" = "[]" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: No PM2 processes running" >> "$LOG_FILE"
  exit 1
fi

# Parse and check thresholds
echo "$PM2_JSON" | jq -r '.[] | select(.pm2_env.status == "online") | "\(.name)|\(.monit.cpu)|\(.monit.memory)"' | while IFS='|' read -r APP_NAME CPU MEM_BYTES; do
  # Convert memory from bytes to MB
  MEM_MB=$((MEM_BYTES / 1024 / 1024))

  # Calculate % memory (assuming 1GB = 1024MB for t2.micro)
  MEM_PCT=$((MEM_MB * 100 / 1024))

  # CPU alert
  if [ "$CPU" -gt "$THRESHOLD_CPU" ]; then
    MESSAGE="⚠️ ALERTA: $APP_NAME usando ${CPU}% CPU (umbral: ${THRESHOLD_CPU}%)"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $MESSAGE" >> "$LOG_FILE"

    if [ -n "$WEBHOOK_URL" ]; then
      curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$MESSAGE\",\"attachments\":[{\"color\":\"warning\",\"fields\":[{\"title\":\"App\",\"value\":\"$APP_NAME\",\"short\":true},{\"title\":\"CPU\",\"value\":\"${CPU}%\",\"short\":true}]}]}" \
        "$WEBHOOK_URL" 2>/dev/null
    fi
  fi

  # Memory alert
  if [ "$MEM_PCT" -gt "$THRESHOLD_MEM" ]; then
    MESSAGE="⚠️ ALERTA: $APP_NAME usando ${MEM_MB}MB / ${MEM_PCT}% memoria (umbral: ${THRESHOLD_MEM}%)"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $MESSAGE" >> "$LOG_FILE"

    if [ -n "$WEBHOOK_URL" ]; then
      curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$MESSAGE\",\"attachments\":[{\"color\":\"danger\",\"fields\":[{\"title\":\"App\",\"value\":\"$APP_NAME\",\"short\":true},{\"title\":\"Memory\",\"value\":\"${MEM_MB}MB (${MEM_PCT}%)\",\"short\":true}]}]}" \
        "$WEBHOOK_URL" 2>/dev/null
    fi
  fi

  # Log current metrics (info level)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $APP_NAME - CPU: ${CPU}%, Memory: ${MEM_MB}MB (${MEM_PCT}%)" >> "$LOG_FILE"
done

# Check for errored/stopped processes
ERRORED=$(echo "$PM2_JSON" | jq -r '.[] | select(.pm2_env.status != "online") | "\(.name)|\(.pm2_env.status)"')

if [ -n "$ERRORED" ]; then
  echo "$ERRORED" | while IFS='|' read -r APP_NAME STATUS; do
    MESSAGE="🚨 CRITICAL: $APP_NAME está en estado: $STATUS"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $MESSAGE" >> "$LOG_FILE"

    if [ -n "$WEBHOOK_URL" ]; then
      curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$MESSAGE\",\"attachments\":[{\"color\":\"danger\",\"title\":\"Process Error\",\"fields\":[{\"title\":\"App\",\"value\":\"$APP_NAME\",\"short\":true},{\"title\":\"Status\",\"value\":\"$STATUS\",\"short\":true}]}]}" \
        "$WEBHOOK_URL" 2>/dev/null
    fi
  done
fi

exit 0
