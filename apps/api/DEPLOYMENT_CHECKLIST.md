# AgroBridge FinTech - Production Deployment Checklist

**Version:** 2.0.0-fintech
**Target Date:** TBD

---

## Pre-Deployment Checklist

### 1. Code Quality
- [x] TypeScript compilation: 0 errors
- [x] ESLint: All warnings resolved
- [x] All tests passing
- [x] Code reviewed
- [ ] Security audit completed

### 2. Environment Configuration
- [ ] Production `.env` configured
- [ ] All API keys rotated (new keys for prod)
- [ ] Database credentials secured
- [ ] JWT_SECRET is 32+ chars random string
- [ ] All secrets stored in AWS Secrets Manager

#### Critical Variables Checklist

**Authentication**
- [ ] JWT_SECRET (new, 32+ chars)
- [ ] SESSION_SECRET (new, 32+ chars)

**WhatsApp**
- [ ] META_WHATSAPP_TOKEN (production token)
- [ ] META_WHATSAPP_PHONE_ID (verified number)
- [ ] META_VERIFY_TOKEN (random 20+ chars)
- [ ] META_WHATSAPP_WEBHOOK_URL (HTTPS only)

**Payments**
- [ ] STRIPE_SECRET_KEY (live key, not test)
- [ ] STRIPE_WEBHOOK_SECRET (production webhook)

**Collections**
- [ ] TWILIO_ACCOUNT_SID (production)
- [ ] TWILIO_AUTH_TOKEN (production)
- [ ] SENDGRID_API_KEY (production)

**Database**
- [ ] DATABASE_URL (RDS production endpoint)
- [ ] DATABASE_SSL=true

**Other**
- [ ] NODE_ENV=production
- [ ] SENTRY_DSN (error tracking)

### 3. Database
- [ ] Production database created (RDS)
- [ ] Database migrations executed
- [ ] Database backups configured (daily)
- [ ] Connection pooling configured
- [ ] SSL connection enabled

### 4. Infrastructure (AWS)
- [ ] ECS cluster created
- [ ] Task definition configured
- [ ] Service created with auto-scaling
- [ ] Load balancer configured (ALB)
- [ ] SSL certificate installed (ACM)
- [ ] DNS configured (Route 53)
- [ ] CloudWatch logs enabled
- [ ] CloudWatch alarms configured

### 5. External Services

#### Meta WhatsApp
- [ ] Business verification completed
- [ ] Phone number verified
- [ ] Webhook URL configured (HTTPS)
- [ ] Webhook verified successfully
- [ ] Template messages approved

#### Stripe
- [ ] Account verified
- [ ] Live keys obtained
- [ ] Webhook endpoint configured
- [ ] Webhook signature verified
- [ ] Test payment successful

#### Twilio
- [ ] Account verified
- [ ] Phone numbers purchased
- [ ] WhatsApp sender approved
- [ ] Test SMS sent successfully

#### SendGrid
- [ ] Domain authenticated
- [ ] Sender verified
- [ ] Test email sent successfully

### 6. Security
- [ ] HTTPS enforced (no HTTP allowed)
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Input validation on all endpoints
- [ ] Audit logging enabled

### 7. Monitoring & Logging
- [ ] CloudWatch logs streaming
- [ ] Error tracking (Sentry) configured
- [ ] Performance monitoring enabled
- [ ] Custom metrics configured
- [ ] Alarms configured:
  - [ ] High error rate (>5%)
  - [ ] High response time (p95 >500ms)
  - [ ] Database connection errors
  - [ ] Collections cron failures

### 8. Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (critical paths)
- [ ] Load testing completed (target: 100 RPS)
- [ ] Webhook testing completed
- [ ] Mobile app integration tested

---

## Deployment Steps

### Phase 1: Database Migration (30 min)

```bash
# 1. Backup current production database
aws rds create-db-snapshot \
  --db-instance-identifier agrobridge-prod \
  --db-snapshot-identifier pre-fintech-$(date +%Y%m%d)

# 2. Run migrations
npm run migrate:prod

# 3. Verify migrations
npm run migrate:status
```

### Phase 2: Application Deployment (45 min)

```bash
# 1. Build Docker image
docker build -t agrobridge-api:v2.0.0-fintech .

# 2. Tag for ECR
docker tag agrobridge-api:v2.0.0-fintech \
  YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/agrobridge:v2.0.0-fintech

# 3. Push to ECR
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/agrobridge:v2.0.0-fintech

# 4. Update ECS task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# 5. Update service (zero-downtime deployment)
aws ecs update-service \
  --cluster agrobridge-prod \
  --service api \
  --task-definition agrobridge-api:LATEST \
  --force-new-deployment
```

### Phase 3: External Service Configuration (30 min)

```bash
# 1. Configure Meta WhatsApp webhook
# Go to: https://developers.facebook.com/apps
# Set webhook URL: https://api.agrobridge.io/api/v1/webhook/whatsapp
# Set verify token: (value from META_VERIFY_TOKEN)

# 2. Configure Stripe webhook
stripe listen --forward-to https://api.agrobridge.io/api/v1/repayments/webhook/stripe

# 3. Test webhooks
curl -X POST https://api.agrobridge.io/api/v1/repayments/webhook/stripe \
  -H "Stripe-Signature: test" \
  -d '{"type":"payment_intent.succeeded"}'
```

### Phase 4: Verification (15 min)

```bash
# 1. Health checks
curl https://api.agrobridge.io/health
curl https://api.agrobridge.io/api/v1/fintech/health

# 2. Test critical endpoints
./test-fintech-endpoints.sh

# 3. Monitor logs
aws logs tail /aws/ecs/agrobridge-api --follow
```

---

## Post-Deployment Validation

### Smoke Tests (15 min)
- [ ] Login successful
- [ ] Create advance
- [ ] Calculate credit score
- [ ] Record payment
- [ ] Send WhatsApp message
- [ ] Collections cron running
- [ ] All 25 endpoints responding

### Performance Tests (30 min)
- [ ] Response time p95 < 200ms
- [ ] Database query time < 50ms
- [ ] No memory leaks (monitor for 1 hour)
- [ ] CPU usage < 70%
- [ ] Connection pool not exhausted

### Security Tests (30 min)
- [ ] HTTPS working (no mixed content)
- [ ] Rate limiting functional
- [ ] Authentication required on protected endpoints
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized

---

## Rollback Plan

If critical issues occur:

### Quick Rollback (5 min)

```bash
# Revert to previous task definition
aws ecs update-service \
  --cluster agrobridge-prod \
  --service api \
  --task-definition agrobridge-api:PREVIOUS_VERSION
```

### Full Rollback (30 min)

```bash
# 1. Restore database snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier agrobridge-prod \
  --db-snapshot-identifier pre-fintech-YYYYMMDD

# 2. Revert code
git revert HEAD
git push origin main

# 3. Redeploy previous version
docker push YOUR_ECR_URL/agrobridge:v1.9.0
aws ecs update-service --task-definition agrobridge-api:v1.9.0
```

---

## Sign-Off

- [ ] Code freeze initiated
- [ ] Stakeholders notified
- [ ] Deployment window scheduled
- [ ] Rollback plan reviewed
- [ ] Team on standby

**Deployment Approved By:**
- [ ] CTO: ___________________ Date: _______
- [ ] Lead Engineer: ___________ Date: _______

---

**Deployment Time Estimate:** 2-3 hours
**Rollback Time (if needed):** 5-30 minutes
**Risk Level:** Medium (new features, no breaking changes)
