# Production Deployment Checklist

Complete checklist for deploying AgroBridge to production.

## Pre-Deployment

### Security Configuration

- [ ] **Environment Variables**
  - [ ] `NODE_ENV` set to `production`
  - [ ] `JWT_ACCESS_SECRET` is cryptographically random (32+ chars)
  - [ ] `JWT_REFRESH_SECRET` is cryptographically random (32+ chars)
  - [ ] `ENCRYPTION_KEY` is 256-bit key (base64 or hex encoded)
  - [ ] All secrets are unique across environments
  - [ ] No secrets are committed to version control

- [ ] **Database Security**
  - [ ] `DATABASE_URL` uses SSL connection (`?sslmode=require`)
  - [ ] Database user has minimal required permissions
  - [ ] Connection pooling configured appropriately
  - [ ] Database backups configured and tested

- [ ] **Redis Security**
  - [ ] `REDIS_PASSWORD` is set and strong
  - [ ] Redis TLS enabled if accessible over network
  - [ ] Redis `bind` configured to appropriate interfaces

- [ ] **AWS/S3 Configuration**
  - [ ] IAM role/user has minimal required permissions
  - [ ] S3 bucket is not publicly accessible
  - [ ] S3 bucket encryption enabled
  - [ ] CloudFront configured for CDN (if applicable)

### Application Security

- [ ] **Rate Limiting**
  - [ ] Rate limiting enabled for all endpoints
  - [ ] Authentication endpoints have strict limits (5/15min)
  - [ ] API endpoints have appropriate limits (100/15min)
  - [ ] Sensitive operations have extra restrictions

- [ ] **Security Headers**
  - [ ] Helmet.js configured and enabled
  - [ ] Content-Security-Policy set appropriately
  - [ ] Strict-Transport-Security enabled (HSTS)
  - [ ] X-Frame-Options set to DENY
  - [ ] X-Content-Type-Options set to nosniff

- [ ] **Input Validation**
  - [ ] Request body size limits configured
  - [ ] File upload limits configured
  - [ ] Input sanitization middleware enabled
  - [ ] JSON depth limits set

- [ ] **Authentication**
  - [ ] JWT tokens have appropriate expiry (15min access, 7d refresh)
  - [ ] Refresh token rotation enabled
  - [ ] Password requirements enforced (8+ chars, mixed case, numbers, special)
  - [ ] Account lockout after failed attempts
  - [ ] 2FA setup and working

### Infrastructure

- [ ] **SSL/TLS**
  - [ ] Valid SSL certificate installed
  - [ ] SSL certificate auto-renewal configured
  - [ ] TLS 1.2+ enforced (no TLS 1.0/1.1)
  - [ ] Strong cipher suites configured

- [ ] **Kubernetes/Container**
  - [ ] Container runs as non-root user
  - [ ] Read-only root filesystem
  - [ ] Resource limits set (CPU, memory)
  - [ ] Health probes configured (liveness, readiness)
  - [ ] Pod security policies applied
  - [ ] Network policies configured

- [ ] **Load Balancing**
  - [ ] Load balancer health checks configured
  - [ ] SSL termination at load balancer (or end-to-end)
  - [ ] Connection draining enabled
  - [ ] Sticky sessions configured if needed

### Monitoring & Logging

- [ ] **Logging**
  - [ ] Structured logging enabled (JSON format)
  - [ ] Log level set to `info` or `warn` (not `debug`)
  - [ ] Sensitive data masked in logs
  - [ ] Log retention policy configured
  - [ ] Log aggregation set up (ELK, CloudWatch, etc.)

- [ ] **Monitoring**
  - [ ] Application metrics exposed (`/metrics`)
  - [ ] Prometheus/Grafana configured
  - [ ] Error tracking enabled (Sentry, etc.)
  - [ ] Uptime monitoring configured

- [ ] **Alerting**
  - [ ] Error rate alerts configured
  - [ ] Response time alerts configured
  - [ ] Resource utilization alerts configured
  - [ ] Security event alerts configured

### Backup & Recovery

- [ ] **Backups**
  - [ ] Database backups scheduled (daily minimum)
  - [ ] Backup retention policy configured (30+ days)
  - [ ] Backups stored in separate region/account
  - [ ] Backup encryption enabled

- [ ] **Disaster Recovery**
  - [ ] Recovery procedures documented
  - [ ] Recovery tested within last 30 days
  - [ ] RTO and RPO defined and achievable
  - [ ] Multi-region failover configured (if required)

---

## Deployment Steps

### 1. Pre-Deployment Verification

```bash
# Run security scan
npm run security:scan

# Run all tests
npm test

# Build production bundle
npm run build

# Verify build output
ls -la dist/
```

### 2. Database Migration

```bash
# Backup current database
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql

# Run migrations
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### 3. Deploy Application

```bash
# For Kubernetes
kubectl apply -f k8s/base/
kubectl rollout status deployment/agrobridge-api

# For Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# For PM2
pm2 start ecosystem.config.js --env production
```

### 4. Post-Deployment Verification

```bash
# Health check
curl https://api.agrobridgeint.com/health

# Readiness check
curl https://api.agrobridgeint.com/health/ready

# Verify API docs
curl https://api.agrobridgeint.com/api-docs

# Run smoke tests
npm run test:smoke
```

---

## Post-Deployment

### Immediate Checks (First 15 minutes)

- [ ] Health endpoint returns 200
- [ ] Readiness endpoint returns 200
- [ ] Login/authentication working
- [ ] API documentation accessible
- [ ] No errors in application logs
- [ ] Database connections healthy
- [ ] Redis connections healthy
- [ ] External services connected (S3, Stripe, etc.)

### Short-term Checks (First hour)

- [ ] Response times within SLA
- [ ] Error rates below threshold (<1%)
- [ ] Memory usage stable
- [ ] CPU usage normal
- [ ] No memory leaks observed
- [ ] All scheduled jobs running

### Monitoring Period (First 24 hours)

- [ ] No unexpected errors
- [ ] Performance metrics stable
- [ ] No security alerts triggered
- [ ] Backup jobs successful
- [ ] User reports reviewed

---

## Rollback Procedure

### When to Rollback

- Error rate exceeds 5%
- Response time exceeds 2x normal
- Critical security vulnerability discovered
- Data corruption detected
- Multiple user reports of failures

### Rollback Steps

```bash
# Kubernetes
kubectl rollout undo deployment/agrobridge-api
kubectl rollout status deployment/agrobridge-api

# Docker Compose
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# PM2
pm2 deploy ecosystem.config.js production revert
```

### Database Rollback (if needed)

```bash
# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup_YYYYMMDD.sql

# Or run migration rollback script
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/rollback.sql
```

---

## Security Verification

### Run Security Scan

```bash
# Full security scan
npm run security:scan

# Check for vulnerabilities in dependencies
npm audit

# Check for secrets in code
npm run security:secrets

# Verify security headers
curl -I https://api.agrobridgeint.com/health
```

### Expected Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Performance Verification

### Load Test

```bash
# Run load tests
npm run test:load

# Expected results:
# - P95 response time < 500ms
# - P99 response time < 1000ms
# - Error rate < 0.1%
# - Throughput > 100 req/s
```

### Benchmarks

| Metric | Target | Critical |
|--------|--------|----------|
| P50 Response Time | < 100ms | < 200ms |
| P95 Response Time | < 300ms | < 500ms |
| P99 Response Time | < 500ms | < 1000ms |
| Error Rate | < 0.1% | < 1% |
| Availability | > 99.9% | > 99% |

---

## Contacts

### On-Call

- **Primary:** DevOps Team - devops@agrobridge.io
- **Secondary:** Backend Team - backend@agrobridge.io
- **Escalation:** CTO - cto@agrobridge.io

### External Services

- **AWS Support:** Case portal or +1-xxx-xxx-xxxx
- **Stripe Support:** dashboard.stripe.com/support
- **SendGrid Support:** support.sendgrid.com

---

## Approval

- [ ] **Developer:** Reviewed and tested
- [ ] **Security:** Security checklist completed
- [ ] **DevOps:** Infrastructure verified
- [ ] **Product:** Feature acceptance
- [ ] **Manager:** Deployment approved

**Deployment Date:** _______________

**Deployed By:** _______________

**Approved By:** _______________
