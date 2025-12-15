#!/bin/bash

# =============================================================================
# AgroBridge Security Scan Script
# Comprehensive security scanning for production deployment
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
INFO=0
PASSED=0

# Functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

print_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_fail() {
    local severity=$1
    local message=$2
    case $severity in
        CRITICAL)
            echo -e "  ${RED}✗ [CRITICAL]${NC} $message"
            ((CRITICAL++))
            ;;
        HIGH)
            echo -e "  ${RED}✗ [HIGH]${NC} $message"
            ((HIGH++))
            ;;
        MEDIUM)
            echo -e "  ${YELLOW}✗ [MEDIUM]${NC} $message"
            ((MEDIUM++))
            ;;
        LOW)
            echo -e "  ${YELLOW}✗ [LOW]${NC} $message"
            ((LOW++))
            ;;
        INFO)
            echo -e "  ${BLUE}ℹ [INFO]${NC} $message"
            ((INFO++))
            ;;
    esac
}

# =============================================================================
# Start Scan
# =============================================================================

print_header "AgroBridge Security Scan"
echo "Scan started at: $(date)"
echo "Environment: ${NODE_ENV:-development}"

# =============================================================================
# 1. Environment Variables Check
# =============================================================================

print_section "Environment Variables"

# Required variables
REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_ACCESS_SECRET"
    "JWT_REFRESH_SECRET"
    "ENCRYPTION_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        print_fail "CRITICAL" "Missing required environment variable: $var"
    else
        print_pass "$var is set"
    fi
done

# Check secret strength
if [ -n "$JWT_ACCESS_SECRET" ] && [ ${#JWT_ACCESS_SECRET} -lt 32 ]; then
    print_fail "HIGH" "JWT_ACCESS_SECRET is too short (< 32 characters)"
fi

if [ -n "$JWT_REFRESH_SECRET" ] && [ ${#JWT_REFRESH_SECRET} -lt 32 ]; then
    print_fail "HIGH" "JWT_REFRESH_SECRET is too short (< 32 characters)"
fi

if [ -n "$ENCRYPTION_KEY" ] && [ ${#ENCRYPTION_KEY} -lt 32 ]; then
    print_fail "HIGH" "ENCRYPTION_KEY is too short (< 32 characters)"
fi

# Check NODE_ENV
if [ "$NODE_ENV" != "production" ]; then
    print_fail "INFO" "NODE_ENV is not set to production"
else
    print_pass "NODE_ENV is set to production"
fi

# =============================================================================
# 2. Dependency Audit
# =============================================================================

print_section "Dependency Audit"

if command -v npm &> /dev/null; then
    echo "Running npm audit..."
    AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)

    if [ -n "$AUDIT_OUTPUT" ]; then
        AUDIT_CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0')
        AUDIT_HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0')
        AUDIT_MODERATE=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.moderate // 0')
        AUDIT_LOW=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.low // 0')

        if [ "$AUDIT_CRITICAL" -gt 0 ]; then
            print_fail "CRITICAL" "$AUDIT_CRITICAL critical vulnerabilities found in dependencies"
        else
            print_pass "No critical vulnerabilities in dependencies"
        fi

        if [ "$AUDIT_HIGH" -gt 0 ]; then
            print_fail "HIGH" "$AUDIT_HIGH high vulnerabilities found in dependencies"
        else
            print_pass "No high vulnerabilities in dependencies"
        fi

        if [ "$AUDIT_MODERATE" -gt 0 ]; then
            print_fail "MEDIUM" "$AUDIT_MODERATE moderate vulnerabilities found in dependencies"
        fi

        if [ "$AUDIT_LOW" -gt 0 ]; then
            print_fail "LOW" "$AUDIT_LOW low vulnerabilities found in dependencies"
        fi
    fi
else
    print_fail "INFO" "npm not found, skipping dependency audit"
fi

# =============================================================================
# 3. Sensitive Files Check
# =============================================================================

print_section "Sensitive Files"

# Check for sensitive files in repository
SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    "private.key"
    "secrets.json"
    "credentials.json"
    "*.pem"
    "*.key"
)

# Check .gitignore
if [ -f ".gitignore" ]; then
    for pattern in "${SENSITIVE_FILES[@]}"; do
        if grep -q "^${pattern}$" .gitignore 2>/dev/null; then
            print_pass "$pattern is in .gitignore"
        elif grep -q "${pattern}" .gitignore 2>/dev/null; then
            print_pass "$pattern pattern is in .gitignore"
        else
            print_fail "HIGH" "$pattern should be in .gitignore"
        fi
    done
else
    print_fail "MEDIUM" ".gitignore file not found"
fi

# Check for hardcoded secrets in code
print_section "Code Secrets Scan"

SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]+['\"]"
    "api[_-]?key\s*=\s*['\"][^'\"]+['\"]"
    "secret\s*=\s*['\"][^'\"]+['\"]"
    "token\s*=\s*['\"][A-Za-z0-9_-]{20,}['\"]"
    "aws_secret_access_key"
    "private_key"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -rn "$pattern" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env" | grep -v "// " | head -5 || true)
    if [ -n "$MATCHES" ]; then
        print_fail "CRITICAL" "Potential hardcoded secret found (pattern: $pattern)"
        echo "    $MATCHES" | head -3
    fi
done

if [ $CRITICAL -eq 0 ]; then
    print_pass "No obvious hardcoded secrets found"
fi

# =============================================================================
# 4. File Permissions Check
# =============================================================================

print_section "File Permissions"

# Check sensitive file permissions
if [ -f ".env" ]; then
    PERMS=$(stat -f "%Lp" .env 2>/dev/null || stat -c "%a" .env 2>/dev/null)
    if [ "$PERMS" -gt 600 ]; then
        print_fail "HIGH" ".env file has insecure permissions ($PERMS), should be 600"
    else
        print_pass ".env file has secure permissions ($PERMS)"
    fi
fi

# =============================================================================
# 5. Security Headers Test
# =============================================================================

print_section "Security Headers (if server is running)"

if [ -n "$API_URL" ]; then
    HEADERS=$(curl -sI "$API_URL/health" 2>/dev/null || true)

    if [ -n "$HEADERS" ]; then
        # Check for security headers
        SECURITY_HEADERS=(
            "X-Content-Type-Options"
            "X-Frame-Options"
            "X-XSS-Protection"
            "Strict-Transport-Security"
            "Content-Security-Policy"
        )

        for header in "${SECURITY_HEADERS[@]}"; do
            if echo "$HEADERS" | grep -qi "$header"; then
                print_pass "$header header is present"
            else
                print_fail "MEDIUM" "$header header is missing"
            fi
        done
    else
        print_fail "INFO" "Could not connect to $API_URL"
    fi
else
    print_fail "INFO" "API_URL not set, skipping security headers test"
fi

# =============================================================================
# 6. TypeScript/ESLint Security
# =============================================================================

print_section "Code Quality"

# Run TypeScript compiler check
if command -v npx &> /dev/null; then
    echo "Running TypeScript check..."
    if npx tsc --noEmit 2>/dev/null; then
        print_pass "TypeScript compilation successful"
    else
        print_fail "MEDIUM" "TypeScript compilation has errors"
    fi
fi

# =============================================================================
# 7. SSL/TLS Check
# =============================================================================

print_section "SSL/TLS Configuration"

if [ -n "$API_URL" ] && [[ "$API_URL" == https://* ]]; then
    DOMAIN=$(echo "$API_URL" | sed 's|https://||' | sed 's|/.*||')

    # Check SSL certificate
    SSL_INFO=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || true)

    if [ -n "$SSL_INFO" ]; then
        EXPIRY=$(echo "$SSL_INFO" | grep "notAfter" | cut -d= -f2)
        EXPIRY_EPOCH=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY" +%s 2>/dev/null || date -d "$EXPIRY" +%s 2>/dev/null)
        NOW_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

        if [ $DAYS_LEFT -lt 7 ]; then
            print_fail "CRITICAL" "SSL certificate expires in $DAYS_LEFT days"
        elif [ $DAYS_LEFT -lt 30 ]; then
            print_fail "HIGH" "SSL certificate expires in $DAYS_LEFT days"
        else
            print_pass "SSL certificate valid for $DAYS_LEFT days"
        fi
    fi
fi

# =============================================================================
# Summary
# =============================================================================

print_header "Scan Summary"

TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW + INFO))

echo -e "  ${RED}Critical: $CRITICAL${NC}"
echo -e "  ${RED}High:     $HIGH${NC}"
echo -e "  ${YELLOW}Medium:   $MEDIUM${NC}"
echo -e "  ${YELLOW}Low:      $LOW${NC}"
echo -e "  ${BLUE}Info:     $INFO${NC}"
echo -e "  ${GREEN}Passed:   $PASSED${NC}"
echo ""

if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 0 ]; then
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  SCAN FAILED - Critical or High issues found${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    exit 1
else
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  SCAN PASSED - No critical or high issues found${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    exit 0
fi
