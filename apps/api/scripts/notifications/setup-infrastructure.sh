#!/bin/bash
#
# setup-infrastructure.sh
# Set up notification system infrastructure on AWS
#
# Prerequisites:
# - AWS CLI configured
# - Terraform installed (optional)
# - Redis/ElastiCache cluster
#
# Usage: ./scripts/notifications/setup-infrastructure.sh [environment]
#

set -e

ENVIRONMENT=${1:-staging}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "=========================================="
echo "Setting up Notification Infrastructure"
echo "Environment: ${ENVIRONMENT}"
echo "=========================================="

# Create ElastiCache Redis cluster (if not exists)
echo "Checking Redis cluster..."
REDIS_CLUSTER_ID="agrobridge-redis-${ENVIRONMENT}"

if ! aws elasticache describe-cache-clusters --cache-cluster-id ${REDIS_CLUSTER_ID} --region ${AWS_REGION} > /dev/null 2>&1; then
    echo "Creating Redis cluster..."
    aws elasticache create-cache-cluster \
        --cache-cluster-id ${REDIS_CLUSTER_ID} \
        --cache-node-type cache.t3.micro \
        --engine redis \
        --num-cache-nodes 1 \
        --region ${AWS_REGION}

    echo "Waiting for Redis cluster to be available..."
    aws elasticache wait cache-cluster-available \
        --cache-cluster-id ${REDIS_CLUSTER_ID} \
        --region ${AWS_REGION}
else
    echo "Redis cluster already exists"
fi

# Create ECR repository for worker
echo "Checking ECR repository..."
ECR_REPO="agrobridge-notification-worker"

if ! aws ecr describe-repositories --repository-names ${ECR_REPO} --region ${AWS_REGION} > /dev/null 2>&1; then
    echo "Creating ECR repository..."
    aws ecr create-repository \
        --repository-name ${ECR_REPO} \
        --region ${AWS_REGION} \
        --image-scanning-configuration scanOnPush=true
else
    echo "ECR repository already exists"
fi

# Create CloudWatch log group
echo "Checking CloudWatch log group..."
LOG_GROUP="/ecs/notification-worker-${ENVIRONMENT}"

if ! aws logs describe-log-groups --log-group-name-prefix ${LOG_GROUP} --region ${AWS_REGION} | grep -q ${LOG_GROUP}; then
    echo "Creating CloudWatch log group..."
    aws logs create-log-group \
        --log-group-name ${LOG_GROUP} \
        --region ${AWS_REGION}

    # Set retention to 30 days
    aws logs put-retention-policy \
        --log-group-name ${LOG_GROUP} \
        --retention-in-days 30 \
        --region ${AWS_REGION}
else
    echo "CloudWatch log group already exists"
fi

# Create SNS topic for alerts
echo "Checking SNS topic..."
SNS_TOPIC="agrobridge-notifications-alerts-${ENVIRONMENT}"

if ! aws sns list-topics --region ${AWS_REGION} | grep -q ${SNS_TOPIC}; then
    echo "Creating SNS topic..."
    aws sns create-topic \
        --name ${SNS_TOPIC} \
        --region ${AWS_REGION}
else
    echo "SNS topic already exists"
fi

# Create CloudWatch alarms
echo "Setting up CloudWatch alarms..."

# Alarm: High queue depth
aws cloudwatch put-metric-alarm \
    --alarm-name "notification-queue-depth-${ENVIRONMENT}" \
    --alarm-description "Notification queue depth exceeds threshold" \
    --metric-name "QueueDepth" \
    --namespace "AgroBridge/Notifications" \
    --statistic Average \
    --period 300 \
    --threshold 10000 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --region ${AWS_REGION} || true

# Alarm: Low delivery rate
aws cloudwatch put-metric-alarm \
    --alarm-name "notification-delivery-rate-${ENVIRONMENT}" \
    --alarm-description "Notification delivery rate below threshold" \
    --metric-name "DeliveryRate" \
    --namespace "AgroBridge/Notifications" \
    --statistic Average \
    --period 300 \
    --threshold 95 \
    --comparison-operator LessThanThreshold \
    --evaluation-periods 3 \
    --region ${AWS_REGION} || true

echo "=========================================="
echo "Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with Redis endpoint"
echo "2. Run: npm run db:migrate"
echo "3. Run: ./scripts/notifications/deploy-worker.sh ${ENVIRONMENT}"
echo "=========================================="
