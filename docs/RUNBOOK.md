# AgroBridge API Operations Runbook

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | DevOps Team |
| Backup | Engineering Lead |
| Infrastructure | AWS Support (if Premium) |

## Quick Links

| Environment | URL |
|-------------|-----|
| Staging API | https://api-staging.agrobridge.io |
| Production API | https://api.agrobridge.io |
| Health Check | https://api-staging.agrobridge.io/health |

---

## Common Incidents

### Application Down (HTTP 502/503)

**Symptoms:** Health check failing, users can't access API

**Diagnosis:**
```bash
# 1. Check PM2 status
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 list"

# 2. Check recent logs
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 logs agrobridge-api-staging --lines 100 --nostream"

# 3. Check system resources
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "free -h && df -h && uptime"
```

**Resolution:**
```bash
# Option 1: Restart PM2
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 restart agrobridge-api-staging"

# Option 2: Full restart
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 delete agrobridge-api-staging && cd /opt/agrobridge-api/apps/api && pm2 start dist/server.js --name agrobridge-api-staging"

# Option 3: Rollback deployment
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "/opt/agrobridge-api/scripts/deploy-staging.sh rollback"
```

---

### Database Connection Issues

**Symptoms:** "Connection refused" or "Authentication failed" errors

**Diagnosis:**
```bash
# 1. Check PostgreSQL status
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo systemctl status postgresql"

# 2. Test connection
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "PGPASSWORD=\$(cat /opt/agrobridge-api/.db_password) psql -U agro_user -h localhost -d agrobridge -c 'SELECT 1;'"

# 3. Check connection count
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo -u postgres psql -c 'SELECT count(*) FROM pg_stat_activity;'"
```

**Resolution:**
```bash
# Restart PostgreSQL
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo systemctl restart postgresql"

# Kill idle connections
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo -u postgres psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < current_timestamp - INTERVAL '10 minutes';\""
```

---

### High CPU Usage (>80%)

**Diagnosis:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "top -bn1 | head -20"
```

**Resolution:**
```bash
# Restart PM2 to free resources
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 restart agrobridge-api-staging"
```

---

### High Memory Usage (>80%)

**Diagnosis:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "free -h && pm2 info agrobridge-api-staging | grep -E 'memory|heap'"
```

**Resolution:**
```bash
# PM2 will auto-restart at 500MB (configured in ecosystem.config.js)
# Manual restart if needed:
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 restart agrobridge-api-staging"
```

---

### Disk Space Full (>90%)

**Diagnosis:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "df -h && du -sh /opt/* /var/log/* 2>/dev/null | sort -h | tail -10"
```

**Resolution:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 << 'CLEANUP'
  # Clean old logs
  find /opt/agrobridge-api/logs -name "*.log" -mtime +7 -delete
  find /opt/agrobridge-backups/daily -mtime +7 -delete
  sudo journalctl --vacuum-time=7d

  # Check space freed
  df -h
CLEANUP
```

---

### Redis Connection Issues

**Diagnosis:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "redis-cli ping"
```

**Resolution:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo systemctl restart redis"
```

---

## Deployment Procedures

### Deploy to Staging

**Automatic (via CI/CD):**
```bash
git push origin develop
# GitHub Actions will automatically deploy
```

**Manual:**
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "/opt/agrobridge-api/scripts/deploy-staging.sh"
```

### Rollback Deployment

```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "/opt/agrobridge-api/scripts/deploy-staging.sh rollback"
```

---

## Database Operations

### Create Backup

```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "/opt/agrobridge-api/scripts/backup-database.sh"
```

### Restore from Backup

```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 << 'RESTORE'
  BACKUP_FILE="/opt/agrobridge-backups/daily/agrobridge_daily_YYYYMMDD_HHMMSS.sql.gz"
  DB_PASSWORD=$(cat /opt/agrobridge-api/.db_password)

  # Stop application first
  pm2 stop agrobridge-api-staging

  # Restore
  gunzip < "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -U agro_user -h localhost -d agrobridge

  # Restart application
  pm2 start agrobridge-api-staging
RESTORE
```

### Run Migrations

```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "cd /opt/agrobridge-api/apps/api && npx prisma migrate deploy"
```

---

## Monitoring & Alerts

### Check System Health

```bash
# Full health check
curl https://api-staging.agrobridge.io/health | jq

# PM2 status
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 monit"

# Resource usage
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 info agrobridge-api-staging"
```

### View Logs

```bash
# Application logs (real-time)
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 logs agrobridge-api-staging"

# Last 100 lines
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "pm2 logs agrobridge-api-staging --lines 100 --nostream"

# Nginx logs
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo tail -f /var/log/nginx/agrobridge_error.log"
```

---

## Security Incidents

### Suspected DDoS Attack

```bash
# Check request rates in Nginx logs
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo tail -1000 /var/log/nginx/access.log | awk '{print \$1}' | sort | uniq -c | sort -nr | head -20"

# Block IP in iptables (if needed)
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199 "sudo iptables -A INPUT -s [MALICIOUS_IP] -j DROP"
```

### Compromised Credentials

1. Rotate database password immediately
2. Rotate JWT secret
3. Invalidate all active sessions (clear Redis)
4. Review audit logs
5. Update .env on server

---

## Post-Incident Review Template

```markdown
## Incident Date: YYYY-MM-DD
**Severity:** P0/P1/P2/P3
**Duration:** X minutes/hours
**Impact:** [Description]

### Timeline
- [Time] - Incident detected
- [Time] - Investigation started
- [Time] - Root cause identified
- [Time] - Fix deployed
- [Time] - Incident resolved

### Root Cause
[Description]

### Action Items
- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]
```

---

## Useful Commands Cheat Sheet

```bash
# SSH to staging
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199

# Quick health check
curl -s https://api-staging.agrobridge.io/health | jq '.status'

# PM2 commands
pm2 list                          # Show all processes
pm2 restart agrobridge-api-staging  # Restart
pm2 logs agrobridge-api-staging   # View logs
pm2 monit                         # Real-time monitoring

# Database
PGPASSWORD=$(cat /opt/agrobridge-api/.db_password) psql -U agro_user -h localhost -d agrobridge

# Nginx
sudo nginx -t                     # Test config
sudo systemctl reload nginx       # Reload
```
