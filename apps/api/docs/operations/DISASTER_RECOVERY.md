# AgroBridge Disaster Recovery Procedures

Disaster recovery and incident response procedures for the AgroBridge platform.

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 1 hour | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 15 minutes | Maximum acceptable data loss |
| **MTTR** (Mean Time to Recovery) | 30 minutes | Target recovery time |

---

## Incident Severity Levels

### SEV-1: Critical
- Complete service outage
- Data loss or corruption
- Security breach
- Response: Immediate, all-hands

### SEV-2: Major
- Partial service degradation
- Key feature unavailable
- Performance severely impacted
- Response: Within 15 minutes

### SEV-3: Minor
- Non-critical feature unavailable
- Minor performance degradation
- Workaround available
- Response: Within 1 hour

### SEV-4: Low
- Cosmetic issues
- Non-urgent improvements
- Response: Next business day

---

## Disaster Scenarios and Procedures

### 1. Complete API Outage

**Symptoms:**
- Health endpoint not responding
- 5xx errors on all endpoints
- No logs being generated

**Diagnosis:**
```bash
# Check if process is running
ssh deploy@prod-api.agrobridge.io
pm2 list
docker ps

# Check system resources
df -h
free -m
top

# Check logs
tail -f /var/log/agrobridge/api.log
docker logs agrobridge-api --tail 100
```

**Recovery:**
```bash
# Restart application
pm2 restart agrobridge-api
# or
docker-compose -f docker-compose.prod.yml restart api

# If restart fails, check dependencies
curl -s localhost:5432 # Database
curl -s localhost:6379 # Redis

# Full system restart if needed
sudo systemctl restart docker
pm2 resurrect
```

**Escalation:** If not resolved in 15 minutes, escalate to SEV-1.

---

### 2. Database Failure

**Symptoms:**
- Database connection errors in logs
- Queries timing out
- Data not persisting

**Diagnosis:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
pg_isready -h $DB_HOST -p 5432

# Check connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check disk space
df -h /var/lib/postgresql
```

**Recovery:**

#### Connection Pool Exhaustion
```bash
# Kill idle connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"

# Restart pgBouncer
sudo systemctl restart pgbouncer
```

#### Database Corruption
```bash
# Stop application
pm2 stop agrobridge-api

# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d agrobridge_recovery /backups/latest.dump

# Verify data
psql -d agrobridge_recovery -c "SELECT count(*) FROM batches;"

# Rename databases
psql -c "ALTER DATABASE agrobridge RENAME TO agrobridge_corrupted;"
psql -c "ALTER DATABASE agrobridge_recovery RENAME TO agrobridge;"

# Restart application
pm2 start agrobridge-api
```

#### Full Database Recovery
```bash
# From point-in-time recovery
pg_basebackup -h replica.agrobridge.io -D /var/lib/postgresql/14/recovery

# Apply WAL logs
pg_ctl -D /var/lib/postgresql/14/recovery start -o "-c recovery_target_time='2024-01-15 14:30:00'"
```

---

### 3. Redis Cache Failure

**Symptoms:**
- Session errors
- Rate limiting not working
- Slow response times

**Diagnosis:**
```bash
# Check Redis status
redis-cli ping
redis-cli info

# Check memory
redis-cli info memory
```

**Recovery:**
```bash
# Restart Redis
sudo systemctl restart redis

# Clear cache if corrupted
redis-cli FLUSHALL

# Application will rebuild cache on next requests
```

**Note:** Redis failure should not cause complete outage - application should gracefully degrade.

---

### 4. Blockchain Service Failure

**Symptoms:**
- NFT minting failing
- Batch registration errors
- Polygon RPC timeouts

**Diagnosis:**
```bash
# Check Polygon network status
curl -X POST https://polygon-rpc.com -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check wallet balance
# Requires blockchain tools
```

**Recovery:**
```bash
# Switch to backup RPC endpoint
# Update RPC_URL environment variable
export POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/$API_KEY"

# Restart application
pm2 restart agrobridge-api

# Process queued blockchain operations
npm run process:blockchain-queue
```

**Note:** Blockchain operations should be queued for retry - temporary failures should not cause data loss.

---

### 5. IPFS Storage Failure

**Symptoms:**
- Document upload failing
- QR codes not generating
- 502 errors on file endpoints

**Diagnosis:**
```bash
# Check IPFS gateway
curl -s "https://ipfs.agrobridge.io/health"

# Check Pinata status
curl -s "https://api.pinata.cloud/data/testAuthentication" -H "Authorization: Bearer $PINATA_JWT"
```

**Recovery:**
```bash
# Switch to backup IPFS provider
export IPFS_GATEWAY="https://cloudflare-ipfs.com"

# Restart application
pm2 restart agrobridge-api

# Re-pin failed uploads
npm run repin:failed-uploads
```

---

### 6. Security Breach

**Symptoms:**
- Unusual access patterns
- Unauthorized API calls
- Suspicious log entries

**Immediate Actions:**
```bash
# 1. Isolate affected systems
sudo iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# 2. Rotate all credentials
# - API keys
# - Database passwords
# - JWT secrets
# - Third-party tokens

# 3. Force logout all sessions
redis-cli FLUSHDB

# 4. Enable maintenance mode
echo "MAINTENANCE_MODE=true" >> .env
pm2 restart agrobridge-api
```

**Investigation:**
```bash
# Export logs for analysis
tar -czf /backups/security-incident-$(date +%Y%m%d).tar.gz /var/log/agrobridge/

# Review access logs
grep -E "(401|403|suspicious)" /var/log/nginx/access.log

# Check for unusual database activity
psql -c "SELECT usename, client_addr, backend_start, query FROM pg_stat_activity ORDER BY backend_start DESC;"
```

**Post-Incident:**
- Conduct security audit
- Update incident report
- Implement additional controls
- Notify affected users if required

---

## Backup Procedures

### Database Backups

```bash
# Daily full backup (automated)
0 2 * * * pg_dump -h $DB_HOST -U $DB_USER -Fc agrobridge > /backups/daily/agrobridge-$(date +\%Y\%m\%d).dump

# Hourly incremental (WAL archiving)
archive_command = 'cp %p /backups/wal/%f'

# Verify backup integrity
pg_restore --list /backups/daily/agrobridge-20240115.dump
```

### Application Backups

```bash
# Code (Git)
git push origin main

# Environment variables
cp .env /backups/config/env-$(date +%Y%m%d)

# SSL certificates
tar -czf /backups/ssl/certs-$(date +%Y%m%d).tar.gz /etc/letsencrypt/
```

### Backup Verification

```bash
# Weekly backup test
# Restore to test environment
pg_restore -h test-db.agrobridge.io -U $DB_USER -d agrobridge_test /backups/daily/latest.dump

# Verify data integrity
psql -d agrobridge_test -c "SELECT count(*) FROM batches;"
psql -d agrobridge_test -c "SELECT count(*) FROM users;"
```

---

## Communication Templates

### Internal Incident Alert

```
INCIDENT ALERT - [SEV-1/2/3/4]

Service: AgroBridge API
Impact: [Description of impact]
Start Time: [UTC timestamp]
Status: Investigating/Identified/Monitoring/Resolved

Current Actions:
- [Action 1]
- [Action 2]

Next Update: [Time]
```

### External Status Update

```
[STATUS] AgroBridge Platform

We are currently experiencing [brief description].

Impact: [User-facing impact]
Status: Our team is actively working on resolution.

Updates will be posted to https://status.agrobridge.io

Thank you for your patience.
```

---

## Post-Incident Review

### Template

```markdown
## Incident Report: [INCIDENT-YYYY-MM-DD-###]

### Summary
- **Duration:** [Start] to [End]
- **Severity:** SEV-[1/2/3/4]
- **Impact:** [Number of users/requests affected]
- **Root Cause:** [Brief description]

### Timeline
- [HH:MM UTC] - Incident detected
- [HH:MM UTC] - On-call engineer paged
- [HH:MM UTC] - Root cause identified
- [HH:MM UTC] - Fix deployed
- [HH:MM UTC] - Service restored

### Root Cause Analysis
[Detailed technical description]

### Resolution
[What was done to fix it]

### Action Items
- [ ] [Preventive measure 1] - Owner: [Name] - Due: [Date]
- [ ] [Preventive measure 2] - Owner: [Name] - Due: [Date]

### Lessons Learned
- [What went well]
- [What could be improved]
```

---

## Emergency Contacts

| Role | Primary | Backup |
|------|---------|--------|
| On-Call Engineer | oncall@agrobridge.io | +1-XXX-XXX-XXXX |
| DevOps Lead | devops@agrobridge.io | +1-XXX-XXX-XXXX |
| CTO | cto@agrobridge.io | +1-XXX-XXX-XXXX |
| AWS Support | support.aws.amazon.com | Enterprise Support |
| Polygon Support | support@polygon.technology | Discord |

---

## Recovery Runbook Quick Reference

| Scenario | First Action | Escalation Time |
|----------|--------------|-----------------|
| API Down | Restart PM2/Docker | 5 min |
| Database Down | Check connections | 10 min |
| Redis Down | Restart Redis | 5 min |
| Blockchain Failed | Switch RPC | 15 min |
| Security Breach | Isolate + Rotate | Immediate |
