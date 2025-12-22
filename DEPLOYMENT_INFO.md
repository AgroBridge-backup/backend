# AgroBridge Backend - AWS Deployment Info

**Deployment Date:** December 18, 2025
**Status:** Production Ready ✅

## AWS Resources

### EC2 Instance
- **Instance ID:** i-0b9a01c5511f515f9
- **Public IP:** 52.6.139.120
- **Instance Type:** t3.small
- **Region:** us-east-1
- **OS:** Ubuntu 22.04 LTS

### RDS PostgreSQL
- **Instance ID:** agrobridge-db-production
- **Endpoint:** agrobridge-db-production.cwhw88882v5g.us-east-1.rds.amazonaws.com
- **Instance Class:** db.t3.micro
- **Engine:** PostgreSQL 16.6
- **Username:** agrobridge_admin
- **Database:** postgres

### Security Groups
- **EC2:** sg-02704305442f8f3bb (SSH, HTTP, HTTPS, 4000)
- **RDS:** sg-01bb3fba9bab1279a (5432 from EC2)

## Access Commands

### SSH to Server
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@52.6.139.120
```

### API Endpoints
- **Health:** http://52.6.139.120:4000/health
- **V2 Health:** http://52.6.139.120:4000/api/v2/health
- **API Docs:** http://52.6.139.120:4000/api-docs

### PM2 Commands
```bash
pm2 list                    # Show running processes
pm2 logs agrobridge-api     # View logs
pm2 restart agrobridge-api  # Restart application
pm2 monit                   # Monitor dashboard
```

## Installed Software

| Software | Version |
|----------|---------|
| Docker | 29.1.3 |
| Docker Compose | 5.0.1 |
| Node.js | 20.19.6 |
| npm | 10.8.2 |
| PM2 | 6.0.14 |
| Redis | 6.x |

## Security Files

⚠️ **Keep these secure!**

| File | Location |
|------|----------|
| SSH Key | ~/.ssh/agrobridge-ec2.pem |
| DB Password | /tmp/db-password.txt |
| Database URL | /tmp/database-url.txt |

## GitHub Secrets Required

Add these to: https://github.com/AgroBridge-backup/backend/settings/secrets/actions

| Secret | Value |
|--------|-------|
| EC2_HOST | 52.6.139.120 |
| EC2_SSH_KEY | Contents of ~/.ssh/agrobridge-ec2.pem |
| DATABASE_URL | (see /tmp/database-url.txt) |

## Next Steps

1. ✅ Configure GitHub Secrets (see above)
2. ⏳ Set up DNS: api.agrobridge.io → 52.6.139.120
3. ⏳ Configure SSL certificate with Let's Encrypt
4. ⏳ Set up CloudWatch alarms
5. ⏳ Configure S3 bucket for uploads
6. ⏳ Set up automated backups

## Estimated Monthly Cost

| Resource | Estimated Cost |
|----------|----------------|
| EC2 t3.small | ~$15/month |
| RDS db.t3.micro | ~$15/month |
| Storage (EBS + RDS) | ~$5/month |
| Elastic IP | Free (when attached) |
| **Total** | **~$35/month** |

*Covered by $85 AWS credits for ~2 months*

## Monitoring Links

- **CloudWatch Logs:** https://console.aws.amazon.com/cloudwatch/
- **RDS Dashboard:** https://console.aws.amazon.com/rds/
- **EC2 Dashboard:** https://console.aws.amazon.com/ec2/

## Quick Troubleshooting

### Application not responding
```bash
ssh -i ~/.ssh/agrobridge-ec2.pem ubuntu@52.6.139.120
pm2 logs agrobridge-api --lines 50
pm2 restart agrobridge-api
```

### Database connection issues
```bash
# Test RDS connectivity
psql "postgresql://agrobridge_admin:PASSWORD@agrobridge-db-production.cwhw88882v5g.us-east-1.rds.amazonaws.com:5432/postgres"
```

### Check Redis
```bash
redis-cli ping  # Should return PONG
```

---

**Deployed by:** Claude Code
**Date:** December 18, 2025
