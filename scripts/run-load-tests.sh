#!/bin/bash
set -e

# ====================================
# AgroBridge Load Testing Script
# Uses k6 for load testing
# ====================================

ENVIRONMENT="${1:-staging}"
BASE_URL=""

case "$ENVIRONMENT" in
    staging)
        BASE_URL="https://api-staging.agrobridge.io"
        ;;
    production)
        BASE_URL="https://api.agrobridge.io"
        ;;
    local)
        BASE_URL="http://localhost:4000"
        ;;
    *)
        echo "Usage: $0 [staging|production|local]"
        exit 1
        ;;
esac

echo "Load Testing: $ENVIRONMENT ($BASE_URL)"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "k6 not found. Installing..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    else
        echo "Please install k6 manually: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
fi

# Run load test
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_FILE="$SCRIPT_DIR/../tests/load/k6-load-test.js"

if [ ! -f "$TEST_FILE" ]; then
    echo "Error: Test file not found at $TEST_FILE"
    exit 1
fi

echo "Running k6 load test..."
k6 run --env BASE_URL="$BASE_URL" "$TEST_FILE"

echo "Load test complete!"
