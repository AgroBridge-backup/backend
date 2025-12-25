# AgroBridge Incident Response Playbooks

Quick-reference playbooks for common incident scenarios.

---

## Playbook 1: High Error Rate

**Trigger:** Error rate > 5% for 5 minutes

### Step 1: Assess (2 min)
```bash
# Check recent deployments
git log --oneline -5

# Check error patterns
grep -c "ERROR" /var/log/agrobridge/api.log | tail -100

# Check Sentry for error grouping
# https://sentry.io/organizations/agrobridge/issues/
```

### Step 2: Identify (5 min)
```bash
# Most common errors
grep "ERROR" /var/log/agrobridge/api.log | tail -50 | sort | uniq -c | sort -rn

# Check affected endpoints
grep "500\|502\|503" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

### Step 3: Mitigate
```bash
# If deployment-related
pm2 rollback agrobridge-api

# If resource-related
pm2 scale agrobridge-api +2

# If external service
# Enable circuit breaker / fallback
```

### Step 4: Resolve
```bash
# Fix root cause
# Deploy fix
# Monitor for 15 minutes
```

---

## Playbook 2: High Latency

**Trigger:** P95 latency > 2s for 5 minutes

### Step 1: Assess (2 min)
```bash
# Check system resources
top -bn1 | head -20
free -m
iostat -x 1 3

# Check slow queries
psql -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Step 2: Identify (5 min)
```bash
# Check slow endpoints
grep -E "duration=[0-9]{4,}" /var/log/agrobridge/api.log | tail -20

# Check database connections
psql -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Check Redis latency
redis-cli --latency-history -i 1
```

### Step 3: Mitigate
```bash
# If database-related
# Kill long-running queries
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '30 seconds';"

# If memory-related
# Restart application
pm2 restart agrobridge-api

# If traffic spike
# Scale up
pm2 scale agrobridge-api +2
```

### Step 4: Resolve
```bash
# Add missing indexes
# Optimize queries
# Scale resources permanently if needed
```

---

## Playbook 3: Database Connection Issues

**Trigger:** "Connection refused" or pool exhaustion errors

### Step 1: Assess (2 min)
```bash
# Check PostgreSQL status
pg_isready -h $DB_HOST

# Check connection count
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check max connections
psql -c "SHOW max_connections;"
```

### Step 2: Identify (3 min)
```bash
# Find connection hogs
psql -c "SELECT usename, application_name, count(*) FROM pg_stat_activity GROUP BY 1,2 ORDER BY 3 DESC;"

# Check for idle connections
psql -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

### Step 3: Mitigate
```bash
# Kill idle connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '5 minutes';"

# Restart pgBouncer if using
sudo systemctl restart pgbouncer

# Restart application to reset pool
pm2 restart agrobridge-api
```

### Step 4: Resolve
```bash
# Review connection pool settings
# Implement connection timeouts
# Add pgBouncer if not present
```

---

## Playbook 4: Memory Leak

**Trigger:** Memory usage steadily increasing, OOM kills

### Step 1: Assess (2 min)
```bash
# Check current memory
free -m
pm2 monit

# Check process memory
ps aux --sort=-%mem | head -10
```

### Step 2: Identify (5 min)
```bash
# Generate heap snapshot (Node.js)
kill -USR2 $(pm2 pid agrobridge-api)

# Check for memory trends
pm2 logs agrobridge-api --lines 100 | grep -i memory
```

### Step 3: Mitigate
```bash
# Restart application (immediate relief)
pm2 restart agrobridge-api

# Schedule regular restarts if pattern
pm2 restart agrobridge-api --cron "0 */4 * * *"
```

### Step 4: Resolve
```bash
# Profile memory usage
# Fix memory leaks in code
# Add proper cleanup handlers
```

---

## Playbook 5: Certificate/TLS Issues

**Trigger:** SSL errors, certificate warnings

### Step 1: Assess (2 min)
```bash
# Check certificate expiry
echo | openssl s_client -servername api.agrobridge.io -connect api.agrobridge.io:443 2>/dev/null | openssl x509 -noout -dates

# Check certificate chain
openssl s_client -connect api.agrobridge.io:443 -showcerts
```

### Step 2: Identify (2 min)
```bash
# Check Let's Encrypt status
sudo certbot certificates

# Check nginx config
nginx -t
```

### Step 3: Mitigate
```bash
# Renew certificate
sudo certbot renew --force-renewal

# Reload nginx
sudo systemctl reload nginx
```

### Step 4: Resolve
```bash
# Set up auto-renewal monitoring
# Add certificate expiry alerts
```

---

## Playbook 6: DDoS/Traffic Spike

**Trigger:** Unusual traffic patterns, resource exhaustion

### Step 1: Assess (2 min)
```bash
# Check request rate
tail -1000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# Check current connections
netstat -an | grep ESTABLISHED | wc -l
```

### Step 2: Identify (3 min)
```bash
# Identify attack vectors
grep -E "POST|PUT|DELETE" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -10

# Check for bot patterns
grep -i "bot\|crawler\|spider" /var/log/nginx/access.log | wc -l
```

### Step 3: Mitigate
```bash
# Block suspicious IPs
sudo iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# Enable rate limiting
# Add to nginx config
# limit_req zone=api burst=20 nodelay;

# Enable Cloudflare Under Attack mode
# Via Cloudflare dashboard
```

### Step 4: Resolve
```bash
# Implement WAF rules
# Add bot detection
# Scale infrastructure
```

---

## Playbook 7: Third-Party Service Outage

**Trigger:** External service (Polygon, IPFS, Pinata) unavailable

### Step 1: Assess (2 min)
```bash
# Check service status pages
# Polygon: https://status.polygon.technology
# IPFS: https://status.pinata.cloud

# Check connectivity
curl -s https://polygon-rpc.com/health
curl -s https://api.pinata.cloud/data/testAuthentication -H "Authorization: Bearer $PINATA_JWT"
```

### Step 2: Identify (2 min)
```bash
# Check error logs
grep -E "polygon|ipfs|pinata" /var/log/agrobridge/api.log | tail -50
```

### Step 3: Mitigate
```bash
# Switch to backup provider
# Polygon: Use Alchemy/Infura backup
export POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY"

# IPFS: Use alternative gateway
export IPFS_GATEWAY="https://cloudflare-ipfs.com"

# Restart to pick up new config
pm2 restart agrobridge-api
```

### Step 4: Resolve
```bash
# Queue failed operations for retry
# Monitor for service recovery
# Process queue when service returns
npm run process:retry-queue
```

---

## Quick Reference Card

```
+------------------+-------------------+-------------------+
| Symptom          | First Check       | Quick Fix         |
+------------------+-------------------+-------------------+
| 5xx Errors       | pm2 logs          | pm2 restart       |
| High Latency     | top, pg_stat      | Kill slow queries |
| No Connections   | pg_isready        | Restart pgbouncer |
| Memory High      | free -m           | pm2 restart       |
| SSL Errors       | certbot certs     | certbot renew     |
| Traffic Spike    | netstat, iptables | Block IPs         |
| External Down    | curl status page  | Switch provider   |
+------------------+-------------------+-------------------+
```

---

## Escalation Matrix

| Time Since Start | Action Required |
|-----------------|-----------------|
| 0-5 min | On-call investigates |
| 5-15 min | Escalate to team lead |
| 15-30 min | Escalate to engineering manager |
| 30-60 min | Escalate to CTO |
| 60+ min | Executive notification |
