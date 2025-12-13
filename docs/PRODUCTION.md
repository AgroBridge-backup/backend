# AgroBridge Production Operations Guide

## Server Information

| Environment | URL | Server |
|-------------|-----|--------|
| Staging | https://api-staging.agrobridge.io | 54.159.230.199 |
| Production | https://api.agrobridge.io | TBD |

## SSH Access

```bash
# Staging
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@54.159.230.199
```

## Service Management

### PM2 Commands

```bash
# View status
pm2 list
pm2 show agrobridge-api-staging

# Restart application
pm2 restart agrobridge-api-staging

# View logs
pm2 logs agrobridge-api-staging --lines 100

# Monitor real-time
pm2 monit
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload (no downtime)
sudo systemctl reload nginx

# View error logs
sudo tail -f /var/log/nginx/agrobridge_error.log
```

## Deployment

### Standard Deployment

Deployments are triggered automatically via GitHub Actions on push to `develop` (staging) or `main` (production).

### Manual Deployment

```bash
cd /opt/agrobridge-api
./scripts/deploy-staging.sh
```

### Rollback

```bash
cd /opt/agrobridge-api
./scripts/deploy-staging.sh rollback
```

## Database Operations

### Backup

```bash
# Manual backup
/opt/agrobridge-api/scripts/backup-database.sh

# View backups
ls -la /opt/agrobridge-backups/daily/
ls -la /opt/agrobridge-backups/weekly/
```

### Restore from Backup

```bash
# Stop application first
pm2 stop agrobridge-api-staging

# Restore
DB_PASSWORD=$(cat /opt/agrobridge-api/.db_password)
gunzip -c /opt/agrobridge-backups/daily/agrobridge_daily_YYYYMMDD_HHMMSS.sql.gz | \
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -U agro_user -d agrobridge

# Restart application
pm2 start agrobridge-api-staging
```

### Database Connection

```bash
DB_PASSWORD=$(cat /opt/agrobridge-api/.db_password)
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U agro_user -d agrobridge
```

## Monitoring

### Health Check

```bash
curl https://api-staging.agrobridge.io/health
```

### Smoke Tests

```bash
/opt/agrobridge-api/scripts/smoke-tests.sh staging
```

### PM2 Monitor

```bash
# View monitoring log
tail -f /var/log/pm2-monitor.log

# Manual run
/opt/agrobridge-api/scripts/pm2-monitor.sh
```

## Cron Jobs

| Schedule | Script | Description |
|----------|--------|-------------|
| */5 * * * * | pm2-monitor.sh | Resource monitoring |
| */10 * * * * | smoke-tests.sh | Health check validation |
| 0 3 * * * | backup-database.sh | Daily database backup |

View current cron jobs:
```bash
crontab -l
```

## SSL Certificate

Managed by Certbot with auto-renewal.

```bash
# Check certificate status
sudo certbot certificates

# Manual renewal (dry-run)
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

## Log Files

| Log | Location |
|-----|----------|
| Application | ~/.pm2/logs/agrobridge-api-staging-*.log |
| PM2 Monitor | /var/log/pm2-monitor.log |
| Smoke Tests | /var/log/smoke-tests.log |
| Database Backups | /var/log/agrobridge-backup.log |
| Nginx Access | /var/log/nginx/agrobridge_access.log |
| Nginx Error | /var/log/nginx/agrobridge_error.log |

## Load Testing

```bash
# Install k6 (if needed)
brew install k6  # macOS

# Run load test
./scripts/run-load-tests.sh staging
```

## Troubleshooting

### Application Not Starting

1. Check logs: `pm2 logs agrobridge-api-staging --lines 50`
2. Verify environment: `cat /opt/agrobridge-api/apps/api/.env`
3. Test database connection manually
4. Check JWT keys exist: `ls -la /opt/agrobridge-api/apps/api/jwtRS256.*`

### Database Connection Issues

1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Test connection: `PGPASSWORD=$(cat /opt/agrobridge-api/.db_password) psql -h localhost -U agro_user -d agrobridge -c "SELECT 1;"`
3. Check pg_hba.conf: `sudo cat /etc/postgresql/14/main/pg_hba.conf`

### 502 Bad Gateway

1. Check PM2: `pm2 list`
2. Verify app is running on port 4000: `curl localhost:4000/health`
3. Check Nginx config: `sudo nginx -t`
4. Check Nginx logs: `sudo tail -f /var/log/nginx/agrobridge_error.log`

## Security Notes

- Database credentials stored in `/opt/agrobridge-api/.db_password` (600 permissions)
- JWT keys stored in `/opt/agrobridge-api/apps/api/` with restricted permissions
- PostgreSQL only accepts localhost connections (SCRAM-SHA-256 auth)
- SSL/TLS enforced via Nginx with Let's Encrypt certificates
- Rate limiting enabled: 10 req/s with burst of 20
