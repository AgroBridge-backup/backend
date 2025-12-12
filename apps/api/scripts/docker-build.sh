#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# AgroBridge Docker Build Script
# ══════════════════════════════════════════════════════════════════════════
# Purpose: Automated Docker image build with metadata and validation
# Author: Alejandro Navarro Ayala - CEO & Senior Developer
# Last Updated: 2025-12-02
# Usage: ./scripts/docker-build.sh [OPTIONS]
# Options:
#   --no-cache    Build without layer caching
#   --push        Push to registry after build (requires REGISTRY env var)
#   --scan        Run security vulnerability scan
# ══════════════════════════════════════════════════════════════════════════

set -euo pipefail
IFS=$'\n\t'

# ──────────────────────────────────────────────────────────────────────────
# PARSE COMMAND LINE ARGUMENTS
# ──────────────────────────────────────────────────────────────────────────
NO_CACHE="${NO_CACHE:-false}"
PUSH="${PUSH:-false}"
SCAN="${SCAN:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --scan)
            SCAN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cache    Build without using Docker layer cache"
            echo "  --push        Push image to registry after successful build"
            echo "  --scan        Run security vulnerability scan with Trivy"
            echo "  --help, -h    Display this help message"
            echo ""
            echo "Environment Variables:"
            echo "  IMAGE_NAME    Override image name (default: agrobridge-api)"
            echo "  REGISTRY      Docker registry URL (required for --push)"
            echo "  VERSION       Override version tag (default: git describe)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# ──────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────
IMAGE_NAME="${IMAGE_NAME:-agrobridge-api}"
REGISTRY="${REGISTRY:-}"
VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')}"
BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ──────────────────────────────────────────────────────────────────────────
# FUNCTIONS
# ──────────────────────────────────────────────────────────────────────────
log() {
    local color=${2:-$GREEN}
    echo -e "${color}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    log "❌ ERROR: $1" "$RED"
    exit 1
}

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# ──────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ──────────────────────────────────────────────────────────────────────────
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$BLUE"
log "🚀 AGROBRIDGE DOCKER BUILD" "$BLUE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$BLUE"
log "   Image: ${IMAGE_NAME}"
log "   Version: ${VERSION}"
log "   Git Commit: ${GIT_COMMIT:0:8}"
log "   Git Branch: ${GIT_BRANCH}"
log "   Build Date: ${BUILD_DATE}"
log ""

# Check Docker is running
if ! docker ps >/dev/null 2>&1; then
    error "Docker daemon is not running. Please start Docker Desktop."
fi

# Build image
log "🔨 Building Docker image..." "$BLUE"
BUILD_START=$(date +%s)

BUILD_ARGS=(
    --build-arg "VERSION=${VERSION}"
    --build-arg "BUILD_DATE=${BUILD_DATE}"
    --build-arg "GIT_COMMIT=${GIT_COMMIT}"
    --file Dockerfile
    --target runtime
    --tag "${IMAGE_NAME}:${VERSION}"
    --tag "${IMAGE_NAME}:latest"
)

# Add no-cache if specified
if [ "$NO_CACHE" = "true" ]; then
    BUILD_ARGS+=(--no-cache)
    log "⚠️  Building without cache" "$YELLOW"
fi

# Execute build
if docker build "${BUILD_ARGS[@]}" .; then
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    log "✅ Build completed in ${BUILD_TIME}s" "$GREEN"
else
    error "Build failed"
fi

# Get image size
if SIZE=$(docker images "${IMAGE_NAME}:${VERSION}" --format "{{.Size}}" 2>/dev/null); then
    log "📊 Image size: ${SIZE}" "$GREEN"

    # Warn if image is too large (convert all units to MB for comparison)
    SIZE_VALUE=$(echo "$SIZE" | grep -oE '[0-9]+\.?[0-9]*')
    SIZE_UNIT=$(echo "$SIZE" | grep -oE '[A-Z]+')

    # Convert to MB
    case "$SIZE_UNIT" in
        GB)
            SIZE_MB=$(echo "$SIZE_VALUE * 1024" | bc | awk '{print int($1)}')
            ;;
        MB)
            SIZE_MB=$(echo "$SIZE_VALUE" | awk '{print int($1)}')
            ;;
        KB)
            SIZE_MB=$(echo "$SIZE_VALUE / 1024" | bc | awk '{print int($1)}')
            ;;
        *)
            SIZE_MB=0
            ;;
    esac

    if [ "$SIZE_MB" -gt 500 ]; then
        log "⚠️  WARNING: Image size (${SIZE_MB}MB) exceeds 500MB target" "$YELLOW"
    fi
fi

# Security scan
if [ "$SCAN" = "true" ]; then
    log "🔍 Running security scan..." "$BLUE"

    if command -v trivy >/dev/null 2>&1; then
        trivy image --severity HIGH,CRITICAL "${IMAGE_NAME}:${VERSION}"
    else
        log "⚠️  Trivy not installed, skipping scan" "$YELLOW"
        log "   Install: brew install aquasecurity/trivy/trivy"
    fi
fi

# Push to registry
if [ "$PUSH" = "true" ]; then
    if [ -z "$REGISTRY" ]; then
        log "⚠️  REGISTRY not set, skipping push" "$YELLOW"
    else
        log "🚀 Pushing to ${REGISTRY}..." "$BLUE"
        docker tag "${IMAGE_NAME}:${VERSION}" "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
        docker tag "${IMAGE_NAME}:latest" "${REGISTRY}/${IMAGE_NAME}:latest"
        docker push "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
        docker push "${REGISTRY}/${IMAGE_NAME}:latest"
        log "✅ Push completed" "$GREEN"
    fi
fi

# Summary
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$GREEN"
log "✅ BUILD SUMMARY" "$GREEN"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$GREEN"
log "   Image: ${IMAGE_NAME}:${VERSION}"
log "   Size: ${SIZE}"
log "   Build Time: ${BUILD_TIME}s"
log ""
log "Next steps:"
log "   - Test: docker run -p 3000:3000 ${IMAGE_NAME}:${VERSION}"
log "   - Or: docker-compose up -d"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "$GREEN"
