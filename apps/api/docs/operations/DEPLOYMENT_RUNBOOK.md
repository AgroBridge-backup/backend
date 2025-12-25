# AgroBridge API Deployment Runbook

Production deployment procedures for the AgroBridge backend API.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No critical security vulnerabilities (`npm audit`)
- [ ] Code reviewed and approved (PR merged to main)

### Environment Verification
- [ ] Environment variables configured in target environment
- [ ] Database migrations prepared and reviewed
- [ ] External service credentials valid (Polygon, IPFS, Sentry)
- [ ] SSL certificates valid (> 30 days remaining)

### Communication
- [ ] Deployment window scheduled
- [ ] Stakeholders notified
- [ ] On-call engineer confirmed

---

## Deployment Procedures

### Standard Deployment (Zero-Downtime)

#### 1. Pre-Deployment Verification

```bash
# Connect to production server
ssh deploy@prod-api.agrobridge.io

# Verify current deployment
cd /opt/agrobridge/api
git log -1 --oneline
docker ps
curl -s localhost:3000/health | jq
```

#### 2. Pull Latest Changes

```bash
# Pull from main branch
git fetch origin main
git checkout main
git pull origin main

# Verify commit
git log -1
```

#### 3. Install Dependencies

```bash
# Install production dependencies
npm ci --production

# Verify no vulnerabilities
npm audit --production
```

#### 4. Run Database Migrations

```bash
# Backup database first (see DR procedures)
pg_dump -h $DB_HOST -U $DB_USER -d agrobridge > /backups/pre-deploy-$(date +%Y%m%d%H%M).sql

# Run migrations
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

#### 5. Build Application

```bash
# Build TypeScript
npm run build

# Verify build output
ls -la dist/
```

#### 6. Deploy with Rolling Update

```bash
# Using PM2 for zero-downtime
pm2 reload agrobridge-api

# Or using Docker
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api
```

#### 7. Post-Deployment Verification

```bash
# Health check
curl -s https://api.agrobridge.io/health | jq

# Readiness check
curl -s https://api.agrobridge.io/health/ready | jq

# Verify logs (no errors)
pm2 logs agrobridge-api --lines 50
# or
docker logs agrobridge-api --tail 50

# Run smoke tests
npm run test:smoke
```

---

### Hotfix Deployment

For critical production issues requiring immediate deployment.

#### 1. Create Hotfix Branch

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix-description
```

#### 2. Apply Fix

```bash
# Make minimal changes
# Test locally
npm test
npm run build
```

#### 3. Fast-Track Review

- Create PR with `[HOTFIX]` prefix
- Request emergency review from on-call engineer
- Bypass normal review queue if approved by tech lead

#### 4. Deploy

```bash
# Follow standard deployment steps 1-7
# with expedited timeline
```

#### 5. Post-Hotfix

```bash
# Merge hotfix to develop branch
git checkout develop
git merge hotfix/critical-fix-description
git push origin develop

# Delete hotfix branch
git branch -d hotfix/critical-fix-description
```

---

### Rollback Procedures

#### Immediate Rollback (< 5 minutes)

```bash
# Using PM2
pm2 describe agrobridge-api | grep "previous"
pm2 rollback agrobridge-api

# Using Docker
docker-compose -f docker-compose.prod.yml down
docker tag agrobridge-api:previous agrobridge-api:latest
docker-compose -f docker-compose.prod.yml up -d

# Using Git
git checkout HEAD~1
npm ci --production
npm run build
pm2 reload agrobridge-api
```

#### Database Rollback

```bash
# Restore from pre-deployment backup
psql -h $DB_HOST -U $DB_USER -d agrobridge < /backups/pre-deploy-YYYYMMDDHHMM.sql

# Or rollback last migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

---

## Environment-Specific Notes

### Staging

```bash
# Staging deployment
ssh deploy@staging-api.agrobridge.io
# Same procedures, less formal review process
```

### Production

```bash
# Production deployment
ssh deploy@prod-api.agrobridge.io
# Full checklist required
# Deployment window: Tuesdays and Thursdays, 2-4 AM UTC
```

---

## Monitoring During Deployment

### Key Metrics to Watch

```bash
# Sentry error rate
# Should not spike above baseline

# Response times
curl -s "https://api.agrobridge.io/health" -w "Time: %{time_total}s\n"

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agrobridge';"

# Memory usage
docker stats agrobridge-api --no-stream
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| P95 Latency | > 500ms | > 2s |
| Memory Usage | > 80% | > 95% |
| CPU Usage | > 70% | > 90% |

---

## Deployment Tools

### PM2 Commands

```bash
pm2 start ecosystem.config.js     # Start
pm2 reload agrobridge-api         # Zero-downtime reload
pm2 restart agrobridge-api        # Full restart
pm2 stop agrobridge-api           # Stop
pm2 delete agrobridge-api         # Remove from PM2
pm2 logs agrobridge-api           # View logs
pm2 monit                         # Real-time monitoring
```

### Docker Commands

```bash
docker-compose -f docker-compose.prod.yml up -d      # Start
docker-compose -f docker-compose.prod.yml down       # Stop
docker-compose -f docker-compose.prod.yml logs -f    # Logs
docker-compose -f docker-compose.prod.yml ps         # Status
docker system prune -af                               # Cleanup
```

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| On-Call Engineer | Rotating | oncall@agrobridge.io |
| DevOps Lead | TBD | devops@agrobridge.io |
| Database Admin | TBD | dba@agrobridge.io |
| Security | TBD | security@agrobridge.io |

---

## Appendix: Deployment Checklist Template

```markdown
## Deployment: [DATE] - [VERSION]

### Pre-Deployment
- [ ] Tests passing
- [ ] Build successful
- [ ] PR approved
- [ ] Migrations reviewed
- [ ] Stakeholders notified

### Deployment
- [ ] Database backed up
- [ ] Migrations applied
- [ ] Application deployed
- [ ] Health check passed
- [ ] Smoke tests passed

### Post-Deployment
- [ ] Logs reviewed
- [ ] Metrics stable
- [ ] Stakeholders notified
- [ ] Documentation updated
```
