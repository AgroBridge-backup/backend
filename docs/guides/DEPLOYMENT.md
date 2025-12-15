# Deployment Guide

Complete guide for deploying AgroBridge to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Methods](#deployment-methods)
- [Database Setup](#database-setup)
- [Redis Setup](#redis-setup)
- [Security Hardening](#security-hardening)
- [Monitoring Setup](#monitoring-setup)
- [Scaling](#scaling)
- [Zero-Downtime Deployment](#zero-downtime-deployment)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

- **Kubernetes Cluster** (GKE, EKS, AKS, or self-hosted)
- **PostgreSQL 16+** (managed service recommended)
- **Redis 7+** (managed service recommended)
- **AWS S3** (or compatible object storage)
- **Domain name** with DNS access
- **SSL certificate** (Let's Encrypt via cert-manager)

### Required Tools

```bash
# Install required CLI tools
brew install kubectl helm k9s awscli

# Verify installations
kubectl version --client
helm version
aws --version
```

### Access Requirements

- Kubernetes cluster admin access
- AWS IAM credentials (for S3)
- Database admin credentials
- DNS management access

---

## Environment Setup

### 1. Create Kubernetes Namespace

```bash
kubectl create namespace agrobridge-production
kubectl config set-context --current --namespace=agrobridge-production
```

### 2. Configure Secrets

Create secrets (DO NOT commit to git):

```bash
# Generate secrets
kubectl create secret generic agrobridge-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  --from-literal=REDIS_PASSWORD="your-redis-password" \
  --from-literal=JWT_ACCESS_SECRET="$(openssl rand -base64 32)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --from-literal=AWS_ACCESS_KEY_ID="your-aws-key" \
  --from-literal=AWS_SECRET_ACCESS_KEY="your-aws-secret" \
  --from-literal=STRIPE_SECRET_KEY="sk_live_..." \
  --from-literal=SENDGRID_API_KEY="SG...." \
  --namespace=agrobridge-production
```

### 3. Configure ConfigMap

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agrobridge-config
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  REDIS_HOST: "redis-master"
  REDIS_PORT: "6379"
  S3_BUCKET: "agrobridge-production"
  AWS_REGION: "us-east-1"
```

```bash
kubectl apply -f k8s/base/configmap.yaml
```

### 4. Set Up TLS Certificate

Using cert-manager:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@agrobridge.io
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

---

## Deployment Methods

### Method 1: Kubernetes Manifests (Recommended)

```bash
# Apply all manifests
kubectl apply -f k8s/base/

# Verify deployment
kubectl get pods
kubectl get services
kubectl get ingress
```

#### Deployment Manifest

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agrobridge-api
  labels:
    app: agrobridge-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agrobridge-api
  template:
    metadata:
      labels:
        app: agrobridge-api
    spec:
      containers:
      - name: api
        image: agrobridge/api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: agrobridge-config
        - secretRef:
            name: agrobridge-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      initContainers:
      - name: migrations
        image: agrobridge/api:latest
        command: ["npx", "prisma", "migrate", "deploy"]
        envFrom:
        - secretRef:
            name: agrobridge-secrets
```

#### Service Manifest

```yaml
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: agrobridge-api
spec:
  selector:
    app: agrobridge-api
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

#### Ingress Manifest

```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agrobridge-api
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.agrobridge.io
    secretName: agrobridge-tls
  rules:
  - host: api.agrobridge.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agrobridge-api
            port:
              number: 80
```

### Method 2: Docker Compose (Development/Staging)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    image: agrobridge/api:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: always

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: agrobridge
      POSTGRES_USER: agrobridge
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: always

volumes:
  postgres_data:
  redis_data:
```

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Method 3: PM2 (Single Server)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'agrobridge-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    merge_logs: true
  }]
};
```

```bash
# Build and start
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## Database Setup

### PostgreSQL on AWS RDS (Recommended)

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier agrobridge-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.1 \
  --master-username agrobridge \
  --master-user-password "SECURE_PASSWORD" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name my-subnet-group \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted
```

### Run Migrations

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Deploy migrations
npx prisma migrate deploy
```

### Database Backup

```bash
# Manual backup
pg_dump -h host -U user -d dbname -F c -f backup.dump

# Restore
pg_restore -h host -U user -d dbname backup.dump
```

---

## Redis Setup

### Redis on AWS ElastiCache (Recommended)

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id agrobridge-redis \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.t3.medium \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxx
```

### Redis on Kubernetes

```bash
helm install redis bitnami/redis \
  --set auth.password=SECURE_PASSWORD \
  --set master.persistence.size=10Gi \
  --set replica.replicaCount=2
```

---

## Security Hardening

### 1. Network Policies

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agrobridge-network-policy
spec:
  podSelector:
    matchLabels:
      app: agrobridge-api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
```

### 2. Pod Security

```yaml
# k8s/pod-security.yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: api
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```

### 3. Environment Variables

- Never commit secrets to git
- Use Kubernetes Secrets or AWS Secrets Manager
- Rotate secrets regularly
- Use separate secrets for each environment

---

## Monitoring Setup

### Prometheus & Grafana

```bash
# Install Prometheus stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
```

### Application Metrics

The API exposes metrics at `/metrics` endpoint:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `http_request_size_bytes` - Request size
- `http_response_size_bytes` - Response size

### Alerting Rules

```yaml
# monitoring/alerts.yaml
groups:
  - name: agrobridge
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
```

---

## Scaling

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agrobridge-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agrobridge-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Manual Scaling

```bash
kubectl scale deployment agrobridge-api --replicas=10
```

---

## Zero-Downtime Deployment

### Rolling Update Strategy

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
```

### Blue-Green Deployment

```bash
# Deploy green version
kubectl apply -f k8s/green-deployment.yaml

# Wait for green to be healthy
kubectl wait --for=condition=available deployment/agrobridge-api-green --timeout=300s

# Switch traffic
kubectl patch service agrobridge-api -p '{"spec":{"selector":{"version":"green"}}}'

# Scale down blue
kubectl scale deployment agrobridge-api-blue --replicas=0
```

---

## Rollback

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/agrobridge-api

# Rollback to previous version
kubectl rollout undo deployment/agrobridge-api

# Rollback to specific revision
kubectl rollout undo deployment/agrobridge-api --to-revision=5
```

### Database Rollback

```bash
# Prisma doesn't support automatic rollback
# Use manual SQL scripts
psql -h host -U user -d dbname -f migrations/rollback.sql
```

---

## Post-Deployment Checklist

- [ ] All pods running and healthy
- [ ] Health endpoints responding
- [ ] Database migrations applied
- [ ] SSL certificate valid
- [ ] Monitoring dashboards working
- [ ] Alerts configured
- [ ] Backup jobs running
- [ ] DNS records updated
- [ ] Load balancer configured
- [ ] Smoke tests passing

---

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod
kubectl describe pod agrobridge-api-xxxxx

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Check logs
kubectl logs agrobridge-api-xxxxx
```

### Database Connection Issues

```bash
# Test connection from pod
kubectl exec -it agrobridge-api-xxxxx -- sh
nc -zv postgres-host 5432
```

### High Memory Usage

```bash
# Check memory usage
kubectl top pods

# Increase memory limits
kubectl patch deployment agrobridge-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

---

## Support

For deployment issues:

- **Email:** devops@agrobridge.io
- **Slack:** #agrobridge-ops
- **On-call:** Check PagerDuty

---

Deployment completed successfully!
