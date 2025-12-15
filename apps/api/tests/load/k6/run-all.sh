#!/bin/bash
#
# Run all k6 load tests
#
# Usage:
#   ./tests/load/k6/run-all.sh
#   BASE_URL=http://staging.api.agrobridge.io ./tests/load/k6/run-all.sh
#
# Prerequisites:
#   - k6 installed (brew install k6)
#   - Server running at BASE_URL
#   - Test users created in database

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
RESULTS_DIR="tests/load/k6/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  AgroBridge Load Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Target: ${YELLOW}${BASE_URL}${NC}"
echo -e "Results: ${YELLOW}${RESULTS_DIR}/${NC}"
echo -e "Timestamp: ${YELLOW}${TIMESTAMP}${NC}"
echo ""

# Create results directory
mkdir -p "${RESULTS_DIR}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}ERROR: k6 is not installed.${NC}"
    echo ""
    echo "Install k6:"
    echo "  macOS:   brew install k6"
    echo "  Linux:   sudo apt-get install k6"
    echo "  Docker:  docker run -i grafana/k6 run -"
    echo ""
    exit 1
fi

# Check if server is running
echo -n "Checking server availability... "
if curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" | grep -q "200\|503"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo ""
    echo -e "${RED}ERROR: Server at ${BASE_URL} is not responding.${NC}"
    echo "Make sure the server is running before running tests."
    echo ""
    exit 1
fi

echo ""

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Run test and save results
run_test() {
    local test_name=$1
    local test_file=$2
    local output_file="${RESULTS_DIR}/${test_name}_${TIMESTAMP}.json"
    local summary_file="${RESULTS_DIR}/${test_name}_${TIMESTAMP}_summary.txt"

    echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
    echo -e "${YELLOW}Running: ${test_name}${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
    echo ""

    TESTS_RUN=$((TESTS_RUN + 1))

    # Run k6 with JSON output
    if BASE_URL="${BASE_URL}" k6 run \
        --out json="${output_file}" \
        --summary-export="${summary_file}" \
        "${test_file}"; then
        echo ""
        echo -e "${GREEN}✓ ${test_name} PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo ""
        echo -e "${RED}✗ ${test_name} FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Parse arguments
RUN_SMOKE=true
RUN_LOAD=true
RUN_STRESS=false
RUN_SPIKE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --smoke-only)
            RUN_LOAD=false
            shift
            ;;
        --load-only)
            RUN_SMOKE=false
            shift
            ;;
        --stress)
            RUN_STRESS=true
            shift
            ;;
        --spike)
            RUN_SPIKE=true
            shift
            ;;
        --all)
            RUN_STRESS=true
            RUN_SPIKE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --smoke-only    Run only smoke test"
            echo "  --load-only     Run only load test"
            echo "  --stress        Include stress test"
            echo "  --spike         Include spike test"
            echo "  --all           Run all tests including stress and spike"
            echo "  --help          Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  BASE_URL        Target URL (default: http://localhost:3000)"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Run tests
START_TIME=$(date +%s)

echo -e "${BLUE}Test Plan:${NC}"
echo -e "  1. Smoke Test:  ${RUN_SMOKE}"
echo -e "  2. Load Test:   ${RUN_LOAD}"
echo -e "  3. Stress Test: ${RUN_STRESS}"
echo -e "  4. Spike Test:  ${RUN_SPIKE}"
echo ""

# 1. Smoke Test
if [ "${RUN_SMOKE}" = true ]; then
    run_test "smoke" "tests/load/k6/scenarios/smoke.test.js" || true
    echo ""
fi

# 2. Load Test
if [ "${RUN_LOAD}" = true ]; then
    run_test "load" "tests/load/k6/scenarios/load.test.js" || true
    echo ""
fi

# 3. Stress Test (optional)
if [ "${RUN_STRESS}" = true ]; then
    echo -e "${YELLOW}WARNING: Stress test will push the system to its limits.${NC}"
    echo -e "${YELLOW}Press Ctrl+C within 5 seconds to skip...${NC}"
    sleep 5
    run_test "stress" "tests/load/k6/scenarios/stress.test.js" || true
    echo ""
fi

# 4. Spike Test (optional)
if [ "${RUN_SPIKE}" = true ]; then
    echo -e "${YELLOW}WARNING: Spike test will simulate sudden traffic surge.${NC}"
    echo -e "${YELLOW}Press Ctrl+C within 5 seconds to skip...${NC}"
    sleep 5
    run_test "spike" "tests/load/k6/scenarios/spike.test.js" || true
    echo ""
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Tests Run:    ${TESTS_RUN}"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo -e "Duration:     ${DURATION}s"
echo ""
echo -e "Results saved to: ${YELLOW}${RESULTS_DIR}/${NC}"
echo ""

# List generated files
echo "Generated files:"
ls -la "${RESULTS_DIR}"/*_${TIMESTAMP}* 2>/dev/null || echo "  (no files)"
echo ""

# Exit with appropriate code
if [ ${TESTS_FAILED} -gt 0 ]; then
    echo -e "${RED}Some tests failed. Review the results for details.${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
