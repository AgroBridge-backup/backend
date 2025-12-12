#!/bin/bash
#
# deploy-worker.sh
# Deploy notification worker to AWS ECS
#
# Usage: ./scripts/notifications/deploy-worker.sh [environment]
# Example: ./scripts/notifications/deploy-worker.sh production
#

set -e

# Configuration
ENVIRONMENT=${1:-staging}
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
IMAGE_NAME=agrobridge-notification-worker
CLUSTER_NAME=agrobridge-${ENVIRONMENT}
SERVICE_NAME=notification-worker-${ENVIRONMENT}
TASK_FAMILY=notification-worker-${ENVIRONMENT}

echo "=========================================="
echo "Deploying Notification Worker"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${AWS_REGION}"
echo "=========================================="

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Error: AWS credentials not configured"
    exit 1
fi

# Build Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:latest -f Dockerfile.worker .

# Tag image
IMAGE_TAG=$(git rev-parse --short HEAD)
docker tag ${IMAGE_NAME}:latest ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
docker tag ${IMAGE_NAME}:latest ${ECR_REGISTRY}/${IMAGE_NAME}:latest

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Push image
echo "Pushing image to ECR..."
docker push ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
docker push ${ECR_REGISTRY}/${IMAGE_NAME}:latest

# Update ECS service
echo "Updating ECS service..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${SERVICE_NAME} \
    --force-new-deployment \
    --region ${AWS_REGION}

# Wait for deployment
echo "Waiting for deployment to complete..."
aws ecs wait services-stable \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --region ${AWS_REGION}

echo "=========================================="
echo "Deployment complete!"
echo "Image: ${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "=========================================="
