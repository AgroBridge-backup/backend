# Deployment Guide - AgroBridge Backend API

## Overview

Complete guide for deploying AgroBridge Backend to production environments.

**Last Updated**: December 12, 2025  
**Status**: ✅ Production Ready  
**Commit**: 8d3d9d5588fe3fde9c4a28b776bc5c5b1542619b  
**Test Coverage**: 86/86 (100%)

---

## Prerequisites

### Required Software

- **Node.js**: 20.x or higher
- **PostgreSQL**: 15.x or higher
- **npm/pnpm**: Latest stable version
- **Git**: 2.x or higher

### Recommended Tools

- **Docker**: 24.x + Docker Compose (for containerized deployment)
- **PM2**: 5.x (for process management)
- **Nginx**: Latest (reverse proxy)
- **Certbot**: Latest (SSL certificates)

### Cloud Accounts (if using AWS)

- AWS Account with IAM permissions
- ECR access for Docker images
- RDS for PostgreSQL database
- ECS/Fargate for container orchestration

---

## Environment Setup

### 1. Environment Variables

Create `.env.production` file with the following variables:

```bash
# ═══════════════════════════════════════════════════════════════════
# AGROBRIDGE BACKEND - PRODUCTION ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

# ─── Application ───────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
API_VERSION=v1

# ─── Database (with connection pooling for production) ─────────────
DATABASE_URL="postgresql://user:password@host:5432/agrobridge?connection_limit=20&pool_timeout=30&schema=public"

# ─── Authentication ────────────────────────────────────────────────
JWT_SECRET="your-super-secret-key-minimum-32-characters-long"
JWT_ACCESS_TOKEN_TTL="7d"
JWT_REFRESH_TOKEN_TTL="30d"

# ─── CORS (whitelist your production domains) ──────────────────────
CORS_ORIGINS="https://app.agrobridge.io,https://admin.agrobridge.io"

# ─── Rate Limiting ─────────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# ─── Redis (for sessions and caching) ──────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# ─── Logging ───────────────────────────────────────────────────────
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/agrobridge/app.log

# ─── External Services (AWS) ───────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=agrobridge-production

# ─── AWS Secrets Manager (SOC2 Compliance) ─────────────────────────
# In production, secrets are loaded from AWS Secrets Manager
# The following are loaded automatically if AWS_SECRET_NAME is set:
#   - DATABASE_URL, JWT_SECRET, REDIS_URL, API keys
AWS_SECRET_NAME=agrobridge/production

# ─── APM Monitoring (Optional) ─────────────────────────────────────
# Choose one: Datadog, New Relic, or AWS X-Ray
DD_AGENT_HOST=localhost
DD_TRACE_ENABLED=false
# NEW_RELIC_LICENSE_KEY=your-key
# AWS_XRAY_DAEMON_ADDRESS=127.0.0.1:2000

# ─── Monitoring & Error Tracking ───────────────────────────────────
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
DATADOG_API_KEY=your-datadog-api-key
```

### 2. Security Checklist

```bash
# Generate strong JWT secret (32+ characters)
openssl rand -base64 32

# Verify no secrets in code
grep -r "password\|secret\|key" src/ --exclude-dir=node_modules

# Verify .env is gitignored
cat .gitignore | grep .env
```

---

## Deployment Methods

### ⭐ Method 1: Traditional Server (PM2) - RECOMMENDED FOR STARTUPS

**Best for**: Single server, cost-effective, simple management

#### Step 1: Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Step 2: Clone & Build

```bash
# Clone repository
git clone https://github.com/AgroBridge-backup/backend.git agrobridge-backend
cd agrobridge-backend/apps/api

# Checkout production-ready commit
git checkout 8d3d9d5588fe3fde9c4a28b776bc5c5b1542619b

# Install dependencies
npm ci --production=false

# Run tests to verify
npm test
# Expected: ✓ 86/86 tests passing

# Build TypeScript to JavaScript
npm run build

# Verify dist folder
ls -la dist/
# Should see: server.js, api/, domain/, infrastructure/, application/

# Remove dev dependencies (production only)
rm -rf node_modules
npm ci --production
```

#### Step 3: Database Setup

```bash
# Create production database
sudo -u postgres psql
```

```sql
CREATE DATABASE agrobridge;
CREATE USER agrobridge_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE agrobridge TO agrobridge_user;
\q
```

```bash
# Set DATABASE_URL in .env.production
export DATABASE_URL="postgresql://agrobridge_user:your-secure-password@localhost:5432/agrobridge?connection_limit=20&pool_timeout=30"

# Run migrations
npx prisma migrate deploy

# Verify migrations
npx prisma migrate status
# Should show: All migrations applied

# Generate Prisma Client
npx prisma generate

# (Optional) Seed initial data
npm run prisma:seed:prod
```

#### Step 4: Start with PM2

```bash
# ecosystem.config.js already created!
# Review configuration:
cat ecosystem.config.js

# Start application
pm2 start ecosystem.config.js

# Check status
pm2 status
# Should show: agrobridge-api (online)

# View logs
pm2 logs agrobridge-api

# Monitor in real-time
pm2 monit

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Copy and run the command it outputs

# Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"healthy","timestamp":"...","database":"connected"}
```

#### Step 5: Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/agrobridge
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name api.agrobridge.io;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase client body size for file uploads
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no logging)
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/agrobridge /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t
# Expected: test is successful

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# Test through Nginx
curl http://api.agrobridge.io/health
```

#### Step 6: SSL/TLS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api.agrobridge.io

# Follow prompts:
# - Email for urgent notices
# - Agree to terms
# - Redirect HTTP to HTTPS (recommended: yes)

# Test auto-renewal
sudo certbot renew --dry-run

# Verify HTTPS
curl https://api.agrobridge.io/health
```

#### PM2 Management Commands

```bash
# Restart application
pm2 restart agrobridge-api

# Stop application
pm2 stop agrobridge-api

# Delete from PM2
pm2 delete agrobridge-api

# Zero-downtime reload
pm2 reload agrobridge-api

# View logs (last 200 lines)
pm2 logs agrobridge-api --lines 200

# Clear logs
pm2 flush

# Monitor CPU/Memory
pm2 monit

# List all processes
pm2 list

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

---

### 🐳 Method 2: Docker Deployment

**Best for**: Containerized environments, easier scaling, consistency

#### Step 1: Build Docker Image

```bash
# Clone repository
git clone https://github.com/AgroBridge-backup/backend.git
cd agrobridge-backend/apps/api

# Build Docker image (multi-stage Dockerfile already exists!)
docker build -t agrobridge-api:latest .

# Verify image
docker images | grep agrobridge-api
# Should show image size ~180-300MB
```

#### Step 2: Run with Docker Compose

```bash
# docker-compose.yml already exists!
# Review configuration:
cat docker-compose.yml

# Start all services (API + PostgreSQL + Redis)
docker-compose up -d

# Check running containers
docker-compose ps

# View logs
docker-compose logs -f api

# Test health endpoint
curl http://localhost:3000/health
```

#### Step 3: Production Docker Deployment

For production, use environment variables:

```bash
# Create .env file for docker-compose
cat > .env << EOF
NODE_ENV=production
POSTGRES_USER=agrobridge
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=agrobridge
JWT_SECRET=your-jwt-secret-32-chars
CORS_ORIGINS=https://app.agrobridge.io
EOF

# Start services
docker-compose up -d

# Run database migrations
docker-compose exec api npx prisma migrate deploy

# Check health
docker-compose exec api curl http://localhost:3000/health
```

#### Docker Management Commands

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# View logs
docker-compose logs -f
docker-compose logs -f api
docker-compose logs -f postgres

# Execute command in container
docker-compose exec api sh
docker-compose exec api npm run prisma:studio

# Scale workers
docker-compose up -d --scale api=3
```

---

### ☁️ Method 3: AWS ECS/Fargate (Enterprise Scale)

**Best for**: High availability, auto-scaling, enterprise requirements

#### Option A: AWS Console (Manual Setup)

1. **Create ECR Repository**
   - Go to AWS ECR Console
   - Create repository: `agrobridge-api`
   - Note the repository URI

2. **Push Docker Image to ECR**

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL

# Tag image
docker tag agrobridge-api:latest $ECR_URL/agrobridge-api:latest

# Push image
docker push $ECR_URL/agrobridge-api:latest
```

3. **Create RDS PostgreSQL Instance**
   - Go to RDS Console
   - Create PostgreSQL 15.x instance
   - Instance type: `db.t3.medium` (or larger)
   - Enable automated backups
   - Note the endpoint URL

4. **Create ECS Cluster**
   - Go to ECS Console
   - Create cluster (Fargate)
   - Name: `agrobridge-cluster`

5. **Create Task Definition**
   - Container: `agrobridge-api`
   - Image: ECR URI from step 2
   - Memory: 1024 MB
   - CPU: 512
   - Port mappings: 3000
   - Environment variables: DATABASE_URL, JWT_SECRET, etc.

6. **Create ECS Service**
   - Launch type: Fargate
   - Desired count: 2
   - Load balancer: Application Load Balancer
   - Target group: Port 3000
   - Health check: `/health`

7. **Configure Auto Scaling**
   - Minimum tasks: 2
   - Maximum tasks: 10
   - Target CPU utilization: 70%

#### AWS Management Commands

```bash
# Update ECS service (deploy new version)
aws ecs update-service \
  --cluster agrobridge-cluster \
  --service agrobridge-api-service \
  --force-new-deployment

# View service status
aws ecs describe-services \
  --cluster agrobridge-cluster \
  --services agrobridge-api-service

# View tasks
aws ecs list-tasks \
  --cluster agrobridge-cluster \
  --service-name agrobridge-api-service

# View logs (CloudWatch)
aws logs tail /ecs/agrobridge-api --follow

# Scale service
aws ecs update-service \
  --cluster agrobridge-cluster \
  --service agrobridge-api-service \
  --desired-count 4
```

---

## Post-Deployment Verification

### Health Checks

```bash
# Basic health check
curl https://api.agrobridge.io/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-12-12T19:00:00.000Z",
  "database": "connected",
  "uptime": 123456
}
```

### Smoke Tests

```bash
# Test authentication
curl -X POST https://api.agrobridge.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test protected endpoint
curl -X GET https://api.agrobridge.io/api/v1/producers \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test rate limiting
for i in {1..10}; do curl https://api.agrobridge.io/api/v1/producers; done
```

### Security Verification

```bash
# Check SSL/TLS
curl -I https://api.agrobridge.io

# Test security headers
curl -I https://api.agrobridge.io | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"

# Verify CORS
curl -H "Origin: https://app.agrobridge.io" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://api.agrobridge.io/api/v1/auth/login -v
```

### Performance Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Load test (100 requests, 10 concurrent)
ab -n 100 -c 10 https://api.agrobridge.io/health

# Expected results:
# - 99th percentile < 200ms
# - 0% failed requests
# - Throughput > 50 req/s
```

---

## Monitoring & Logging

### CloudWatch (AWS)

```bash
# Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name agrobridge-high-error-rate \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold

# View logs
aws logs tail /ecs/agrobridge-api --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/agrobridge-api \
  --filter-pattern "ERROR"
```

### PM2 Monitoring

```bash
# View real-time logs
pm2 logs agrobridge-api

# Monitor metrics
pm2 monit

# Generate monitoring report
pm2 report
```

---

## Rollback Procedures

### PM2 Rollback

```bash
# List previous deployments
git log --oneline -10

# Checkout previous version
git checkout PREVIOUS_COMMIT_HASH

# Rebuild and restart
npm run build
pm2 restart agrobridge-api
```

### Docker Rollback

```bash
# List previous images
docker images agrobridge-api

# Tag previous version as latest
docker tag agrobridge-api:PREVIOUS_TAG agrobridge-api:latest

# Restart with previous version
docker-compose up -d app
```

### AWS ECS Rollback

```bash
# List task definitions
aws ecs list-task-definitions --family-prefix agrobridge-api

# Update service to previous task definition
aws ecs update-service \
  --cluster agrobridge-cluster \
  --service agrobridge-api-service \
  --task-definition agrobridge-api:PREVIOUS_REVISION
```

---

## Maintenance

### Database Backups

```bash
# Manual backup
pg_dump -h localhost -U postgres -d agrobridge > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
cat > /usr/local/bin/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres -d agrobridge | gzip > $BACKUP_DIR/backup_$DATE.sql.gz
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
0 2 * * * /usr/local/bin/backup-db.sh
```

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Update dependencies
npm update

# Check outdated packages
npm outdated
```

### SSL Certificate Renewal

```bash
# Auto-renewal is setup with certbot
# Manual renewal if needed:
sudo certbot renew

# Test renewal process
sudo certbot renew --dry-run
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Database Connection Failed

```bash
# Check database status
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check Prisma connection
npx prisma db pull
```

#### Issue 2: High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart agrobridge-api

# Increase memory limit in ecosystem.config.js
# max_memory_restart: '2G'
```

#### Issue 3: SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Restart nginx
sudo systemctl restart nginx
```

#### Issue 4: Rate Limiting Too Aggressive

```bash
# Adjust in .env.production
RATE_LIMIT_MAX_REQUESTS=200  # Increased from 100

# Restart application
pm2 restart agrobridge-api
```

---

## Performance Optimization

### Database Optimization

```sql
-- Add missing indexes
CREATE INDEX idx_producers_user_id ON producers(user_id);
CREATE INDEX idx_batches_producer_id ON batches(producer_id);
CREATE INDEX idx_events_batch_id ON events(batch_id);

-- Analyze tables
ANALYZE producers;
ANALYZE batches;
ANALYZE events;

-- Vacuum database
VACUUM ANALYZE;
```

### Caching Strategy

```typescript
// Add to middleware
import { cacheMiddleware } from '@/api/middleware/cache';

// Cache GET requests for 5 minutes
router.get('/producers', cacheMiddleware(300), producerController.list);
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        
      - name: Deploy to PM2
        run: |
          pm2 deploy ecosystem.config.js production
```

---

## Support & Contacts

**Technical Lead**: [Your contact]  
**DevOps**: [DevOps contact]  
**AWS Support**: [Support plan details]  
**Database Admin**: [DBA contact]  
**Security Team**: security@agrobridge.io

---

**Guide Version**: 1.0.0  
**Last Updated**: December 12, 2025  
**Maintained by**: AgroBridge Engineering Team
