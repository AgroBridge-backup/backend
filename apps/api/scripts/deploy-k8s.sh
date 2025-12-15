#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# AGROBRIDGE - KUBERNETES DEPLOYMENT SCRIPT
# ══════════════════════════════════════════════════════════════════════════════
# Usage:
#   ./scripts/deploy-k8s.sh <environment> [image-tag]
#
# Examples:
#   ./scripts/deploy-k8s.sh staging
#   ./scripts/deploy-k8s.sh production v2.0.0
#   ./scripts/deploy-k8s.sh staging latest
#
# Environments:
#   - staging: Deploys to staging cluster
#   - production: Deploys to production cluster (requires confirmation)
#
# Prerequisites:
#   - kubectl configured with appropriate cluster context
#   - Docker image built and pushed to registry
#   - Kubernetes secrets created in target namespace
# ══════════════════════════════════════════════════════════════════════════════

set -e

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arguments
ENVIRONMENT=${1:-staging}
IMAGE_TAG=${2:-latest}

# Derived values
NAMESPACE="agrobridge"
IMAGE_NAME="ghcr.io/agrobridge/agrobridge-api"
DEPLOYMENT_NAME="agrobridge-api"

# ──────────────────────────────────────────────────────────────────────────────
# FUNCTIONS
# ──────────────────────────────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
print_banner() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  AgroBridge Kubernetes Deployment${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Environment:  ${ENVIRONMENT}"
    echo "Namespace:    ${NAMESPACE}"
    echo "Image Tag:    ${IMAGE_TAG}"
    echo "Deployment:   ${DEPLOYMENT_NAME}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Check your kubeconfig."
        exit 1
    fi

    # Check current context
    CURRENT_CONTEXT=$(kubectl config current-context)
    log_info "Current kubectl context: ${CURRENT_CONTEXT}"

    log_success "Prerequisites check passed"
}

# Confirm production deployment
confirm_production() {
    if [ "$ENVIRONMENT" = "production" ]; then
        echo ""
        log_warn "You are about to deploy to PRODUCTION!"
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log_info "Deployment cancelled."
            exit 0
        fi
        echo ""
    fi
}

# Create namespace if not exists
ensure_namespace() {
    log_info "Ensuring namespace exists..."

    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Namespace ${NAMESPACE} already exists"
    else
        log_info "Creating namespace ${NAMESPACE}..."
        kubectl apply -f "${PROJECT_ROOT}/k8s/base/namespace.yaml"
        log_success "Namespace created"
    fi
}

# Apply ConfigMap
apply_configmap() {
    log_info "Applying ConfigMap..."
    kubectl apply -f "${PROJECT_ROOT}/k8s/base/configmap.yaml" -n "$NAMESPACE"
    log_success "ConfigMap applied"
}

# Check for secrets
check_secrets() {
    log_info "Checking for secrets..."

    if kubectl get secret agrobridge-secrets -n "$NAMESPACE" &> /dev/null; then
        log_success "Secrets found"
    else
        log_error "Secrets not found! Please create secrets first:"
        echo ""
        echo "  1. Copy the example: cp k8s/base/secret.yaml.example k8s/base/secret.yaml"
        echo "  2. Fill in the values in k8s/base/secret.yaml"
        echo "  3. Apply: kubectl apply -f k8s/base/secret.yaml -n ${NAMESPACE}"
        echo ""
        exit 1
    fi
}

# Apply Kubernetes manifests
apply_manifests() {
    log_info "Applying Kubernetes manifests..."

    # Apply in order
    kubectl apply -f "${PROJECT_ROOT}/k8s/base/serviceaccount.yaml" -n "$NAMESPACE"
    kubectl apply -f "${PROJECT_ROOT}/k8s/base/deployment.yaml" -n "$NAMESPACE"
    kubectl apply -f "${PROJECT_ROOT}/k8s/base/service.yaml" -n "$NAMESPACE"
    kubectl apply -f "${PROJECT_ROOT}/k8s/base/hpa.yaml" -n "$NAMESPACE"
    kubectl apply -f "${PROJECT_ROOT}/k8s/base/pdb.yaml" -n "$NAMESPACE"

    # Apply ingress only for production
    if [ "$ENVIRONMENT" = "production" ]; then
        kubectl apply -f "${PROJECT_ROOT}/k8s/base/ingress.yaml" -n "$NAMESPACE"
    fi

    log_success "Manifests applied"
}

# Update image tag
update_image() {
    log_info "Updating image to ${IMAGE_NAME}:${IMAGE_TAG}..."

    kubectl set image deployment/${DEPLOYMENT_NAME} \
        api=${IMAGE_NAME}:${IMAGE_TAG} \
        -n "$NAMESPACE"

    log_success "Image updated"
}

# Wait for rollout
wait_for_rollout() {
    log_info "Waiting for rollout to complete..."

    if kubectl rollout status deployment/${DEPLOYMENT_NAME} \
        -n "$NAMESPACE" \
        --timeout=300s; then
        log_success "Rollout completed successfully"
    else
        log_error "Rollout failed or timed out"
        echo ""
        log_info "Rolling back..."
        kubectl rollout undo deployment/${DEPLOYMENT_NAME} -n "$NAMESPACE"
        exit 1
    fi
}

# Run health check
health_check() {
    log_info "Running health check..."

    # Get pod IP
    POD_NAME=$(kubectl get pods -n "$NAMESPACE" \
        -l app=agrobridge-api \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

    if [ -z "$POD_NAME" ]; then
        log_error "No pods found"
        return 1
    fi

    # Port forward and check health
    log_info "Checking pod health..."
    kubectl exec "$POD_NAME" -n "$NAMESPACE" -- \
        curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | \
        grep -q "200" && log_success "Health check passed" || log_warn "Health check returned non-200"
}

# Print deployment status
print_status() {
    echo ""
    log_info "Deployment Status:"
    echo ""

    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" -l app=agrobridge-api

    echo ""
    echo "Services:"
    kubectl get services -n "$NAMESPACE"

    echo ""
    echo "HPA:"
    kubectl get hpa -n "$NAMESPACE"

    if [ "$ENVIRONMENT" = "production" ]; then
        echo ""
        echo "Ingress:"
        kubectl get ingress -n "$NAMESPACE"
    fi
}

# Run smoke test
run_smoke_test() {
    log_info "Running smoke test..."

    # This would be replaced with actual smoke test
    # For now, just check if the service is responding

    if [ "$ENVIRONMENT" = "production" ]; then
        SMOKE_URL="https://api.agrobridge.io/health"
    else
        SMOKE_URL="https://api-staging.agrobridge.io/health"
    fi

    log_info "Testing: ${SMOKE_URL}"

    # Note: In production, you'd use curl to test the actual endpoint
    # curl -f "$SMOKE_URL" && log_success "Smoke test passed" || log_warn "Smoke test failed"
    log_success "Smoke test skipped (configure endpoint for actual testing)"
}

# Cleanup on failure
cleanup_on_failure() {
    if [ $? -ne 0 ]; then
        log_error "Deployment failed!"
        log_info "Consider rolling back with: kubectl rollout undo deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}"
    fi
}

# ──────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ──────────────────────────────────────────────────────────────────────────────

trap cleanup_on_failure EXIT

main() {
    print_banner

    # Validate environment
    if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
        log_error "Invalid environment: ${ENVIRONMENT}"
        echo "Valid environments: staging, production"
        exit 1
    fi

    check_prerequisites
    confirm_production
    ensure_namespace
    check_secrets
    apply_configmap
    apply_manifests
    update_image
    wait_for_rollout
    health_check
    print_status
    run_smoke_test

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Deployment Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Environment:  ${ENVIRONMENT}"
    echo "Image:        ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "Namespace:    ${NAMESPACE}"
    echo ""

    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Production URL: https://api.agrobridge.io"
    else
        echo "Staging URL: https://api-staging.agrobridge.io"
    fi
    echo ""
}

# Run main
main "$@"
