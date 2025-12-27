# AgroBridge Disaster Recovery Plan

## Executive Summary

This document outlines the disaster recovery procedures for AgroBridge's production infrastructure. Our backup strategy ensures business continuity with the following targets:

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** | < 1 hour | Recovery Time Objective - Maximum acceptable downtime |
| **RPO** | < 24 hours | Recovery Point Objective - Maximum acceptable data loss |

---

## 1. Backup Architecture

### 1.1 Backup Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AgroBridge Backup Architecture                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    Daily 3AM CST    ┌──────────────────────┐    │
│   │  PostgreSQL  │ ─────────────────▶  │  postgres-backup     │    │
│   │   Database   │                      │  (pg_dump + gzip)    │    │
│   └──────────────┘                      └──────────┬───────────┘    │
│                                                    │                 │
│                                                    ▼                 │
│                                         ┌──────────────────────┐    │
│                                         │  Local Volume        │    │
│                                         │  (postgres_backups)  │    │
│                                         │  30-day retention    │    │
│                                         └──────────┬───────────┘    │
│                                                    │                 │
│                                         Daily 4AM CST               │
│                                                    ▼                 │
│                                         ┌──────────────────────┐    │
│                                         │  AWS S3              │    │
│                                         │  (Standard-IA)       │    │
│                                         │  90-day retention    │    │
│                                         └──────────────────────┘    │
│                                                                      │
│   ┌──────────────┐    Continuous       ┌──────────────────────┐    │
│   │    Redis     │ ─────────────────▶  │  AOF + RDB Snapshots │    │
│   │    Cache     │    (appendfsync)    │  (redis_data volume) │    │
│   └──────────────┘                      └──────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Backup Schedule

| Service | Method | Schedule | Retention |
|---------|--------|----------|-----------|
| PostgreSQL | pg_dump + gzip | Daily 3:00 AM CST (9:00 UTC) | 30 days local, 90 days S3 |
| PostgreSQL | S3 sync | Daily 4:00 AM CST (10:00 UTC) | 90 days |
| Redis | AOF (appendfsync everysec) | Continuous | Until restart |
| Redis | RDB Snapshots | 900s/1, 300s/10, 60s/10000 | Until restart |

### 1.3 Storage Locations

| Location | Type | Purpose | Encryption |
|----------|------|---------|------------|
| `postgres_backups` volume | Docker volume | Primary backup storage | At-rest via host |
| `s3://[bucket]/agrobridge/backups/` | AWS S3 Standard-IA | Off-site backup | AES-256 SSE |
| `redis_data` volume | Docker volume | Redis persistence | At-rest via host |

---

## 2. Disaster Scenarios

### 2.1 Scenario Classification

| Level | Description | Example | RTO |
|-------|-------------|---------|-----|
| **L1** | Service Degradation | Single container crash | < 5 min |
| **L2** | Partial Outage | Database corruption, volume loss | < 30 min |
| **L3** | Full Outage | Complete infrastructure failure | < 1 hour |
| **L4** | Regional Disaster | AWS region failure | < 4 hours |

---

## 3. Recovery Procedures

### 3.1 L1: Container Restart

**Symptoms:** Single service unresponsive, health check failures

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Restart affected service
docker-compose -f docker-compose.prod.yml restart api

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

### 3.2 L2: Database Recovery from Local Backup

**Symptoms:** Database corruption, accidental data deletion

#### Step 1: Stop Application Services

```bash
# Stop API to prevent further writes
docker-compose -f docker-compose.prod.yml stop api

# Verify database is accessible
docker-compose -f docker-compose.prod.yml exec postgres pg_isready
```

#### Step 2: Identify Available Backups

```bash
# List local backups
docker-compose -f docker-compose.prod.yml run --rm postgres-backup ls -la /backups/

# Or directly access the volume
docker run --rm -v agrobridge_postgres_backups:/backups alpine ls -la /backups/
```

#### Step 3: Restore from Backup

```bash
# Create a new database (or drop and recreate existing)
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U agrobridge -c "CREATE DATABASE agrobridge_restored;"

# Decompress and restore backup
docker-compose -f docker-compose.prod.yml exec postgres \
  bash -c "gunzip -c /backups/agrobridge_prod-YYYY-MM-DD.sql.gz | psql -U agrobridge -d agrobridge_restored"

# Verify restoration
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U agrobridge -d agrobridge_restored -c "SELECT COUNT(*) FROM \"User\";"
```

#### Step 4: Switch to Restored Database

```bash
# Update DATABASE_URL in .env.production
# Change database name from agrobridge_prod to agrobridge_restored

# Restart API with new database
docker-compose -f docker-compose.prod.yml up -d api
```

### 3.3 L3: Full Recovery from S3 Backup

**Symptoms:** Complete volume loss, infrastructure failure

#### Step 1: Provision New Infrastructure

```bash
# Clone repository
git clone https://github.com/agrobridge/agrobridge-backend.git
cd agrobridge-backend/apps/api

# Copy production environment
cp .env.production.example .env.production
# Edit with production values
```

#### Step 2: Download Backup from S3

```bash
# Create backup directory
mkdir -p ./backups/postgres

# List available backups
aws s3 ls s3://${BACKUP_S3_BUCKET}/agrobridge/backups/postgres/ --recursive

# Download latest backup
aws s3 cp s3://${BACKUP_S3_BUCKET}/agrobridge/backups/postgres/YYYY-MM-DD/agrobridge_prod-YYYY-MM-DD.sql.gz \
  ./backups/postgres/
```

#### Step 3: Start Database Services

```bash
# Start PostgreSQL only
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for healthy status
docker-compose -f docker-compose.prod.yml ps postgres
```

#### Step 4: Restore Database

```bash
# Copy backup into container
docker cp ./backups/postgres/agrobridge_prod-YYYY-MM-DD.sql.gz \
  agrobridge-postgres-prod:/tmp/

# Restore
docker-compose -f docker-compose.prod.yml exec postgres \
  bash -c "gunzip -c /tmp/agrobridge_prod-YYYY-MM-DD.sql.gz | psql -U agrobridge -d agrobridge_prod"
```

#### Step 5: Start All Services

```bash
# Start Redis
docker-compose -f docker-compose.prod.yml up -d redis

# Start API
docker-compose -f docker-compose.prod.yml up -d api

# Verify health
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:3000/health
```

### 3.4 L4: Cross-Region Recovery

**Symptoms:** AWS region completely unavailable

1. **Switch to backup region** (if configured)
2. **Update DNS** to point to backup region
3. **Restore from S3** (S3 buckets can be cross-region replicated)
4. **Notify stakeholders** of extended RTO

---

## 4. Verification Procedures

### 4.1 Manual Backup Verification

```bash
# Run verification script
docker-compose -f docker-compose.prod.yml --profile backup-verify up backup-verify

# Check verification report
docker logs agrobridge-backup-verify
```

### 4.2 S3 Sync Verification

```bash
# Run S3 sync
docker-compose -f docker-compose.prod.yml --profile backup-sync up backup-sync

# Verify S3 contents
aws s3 ls s3://${BACKUP_S3_BUCKET}/agrobridge/backups/postgres/ --recursive
```

### 4.3 Health Check Monitoring

```bash
# Enable monitoring profile
docker-compose -f docker-compose.prod.yml --profile monitoring up -d backup-monitor

# Check health status
docker logs agrobridge-backup-monitor
```

---

## 5. Runbooks

### 5.1 Daily Operations Checklist

- [ ] Verify backup completed successfully (check Slack/email alerts)
- [ ] Confirm S3 sync completed (check CloudWatch metrics)
- [ ] Review backup monitor logs for warnings

### 5.2 Weekly Verification

- [ ] Run backup verification: `./scripts/verify-backup.sh`
- [ ] Test restoration to verification database
- [ ] Review backup retention and cleanup old backups
- [ ] Check disk space utilization

### 5.3 Monthly DR Drill

- [ ] Perform full restoration to staging environment
- [ ] Measure actual RTO/RPO
- [ ] Document any issues and update procedures
- [ ] Review and update contact information

---

## 6. Contact Information

### 6.1 Escalation Path

| Level | Contact | Method | Response Time |
|-------|---------|--------|---------------|
| L1 | On-call Engineer | PagerDuty | < 15 min |
| L2 | DevOps Lead | Phone + Slack | < 30 min |
| L3 | CTO | Phone | < 1 hour |
| L4 | CEO + Legal | Phone | < 2 hours |

### 6.2 External Resources

| Service | Contact | Account ID |
|---------|---------|------------|
| AWS Support | AWS Console | (configured in AWS) |
| Stripe | dashboard.stripe.com | (configured in Stripe) |

---

## 7. Configuration Reference

### 7.1 Environment Variables for Backup

```bash
# PostgreSQL Backup
POSTGRES_DB=agrobridge_prod
POSTGRES_USER=agrobridge
POSTGRES_PASSWORD=<secure-password>

# S3 Backup Storage
BACKUP_S3_BUCKET=agrobridge-backups
BACKUP_S3_PREFIX=agrobridge/backups
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=us-east-1

# Monitoring & Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_EMAIL=ops@agrobridge.io
MAX_BACKUP_AGE_HOURS=26

# Retention
BACKUP_KEEP_DAYS=30
BACKUP_KEEP_WEEKS=4
BACKUP_KEEP_MONTHS=6
```

### 7.2 Docker Compose Profiles

| Profile | Purpose | Command |
|---------|---------|---------|
| (default) | Core services | `docker-compose up -d` |
| `backup-sync` | Sync to S3 | `docker-compose --profile backup-sync up` |
| `backup-verify` | Verify backup | `docker-compose --profile backup-verify up` |
| `monitoring` | Health monitoring | `docker-compose --profile monitoring up -d` |

---

## 8. Appendix

### 8.1 Quick Reference Commands

```bash
# Start production with all backup services
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Manual backup trigger
docker-compose -f docker-compose.prod.yml exec postgres-backup /backup.sh

# Manual S3 sync
docker-compose -f docker-compose.prod.yml --profile backup-sync up backup-sync

# Check backup health
./scripts/check-backup-health.sh

# Verify latest backup
./scripts/verify-backup.sh

# List all backups
find /var/lib/docker/volumes/agrobridge_postgres_backups/_data -name "*.sql.gz" | sort
```

### 8.2 Recovery Time Estimates

| Operation | Estimated Time | Dependencies |
|-----------|----------------|--------------|
| Container restart | 30 seconds | None |
| Local backup restore (10GB) | 5-10 minutes | Disk I/O |
| S3 download (10GB) | 10-20 minutes | Network bandwidth |
| Database restore (10GB) | 10-15 minutes | CPU, Disk I/O |
| Full infrastructure rebuild | 30-60 minutes | All above |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-27 | DevOps | Initial version |

**Next Review Date:** Monthly or after any DR incident

---

*This document is confidential and intended for AgroBridge operations team only.*
