# Deployment Guide

This guide covers deploying the AgroBridge API to production.

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy (PM2) | `pm2 start ecosystem.config.js` |
| Deploy (Docker) | `docker-compose up -d` |
| View logs | `pm2 logs` or `docker-compose logs -f` |
| Restart | `pm2 restart agrobridge-api` |
| Roll back | `git checkout <previous-commit> && npm run build && pm2 restart agrobridge-api` |
| Health check | `curl https://your-domain.com/health` |

---

## Choose Your Deployment Method

| Method | Best For | Complexity |
|--------|----------|------------|
| **[PM2](#pm2-deployment)** | Single server, startups | Simple |
| **[Docker](#docker-deployment)** | Consistency, local-to-prod parity | Medium |
| **[AWS ECS](#aws-ecs-deployment)** | Auto-scaling, enterprise | Advanced |

**Recommendation:** Start with PM2. Move to Docker/ECS when you need scaling.

---

## PM2 Deployment

### First-Time Setup

**1. Prepare the server:**
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
```

**2. Set up the database:**
```bash
sudo -u postgres psql -c "CREATE DATABASE agrobridge;"
sudo -u postgres psql -c "CREATE USER agrobridge_user WITH ENCRYPTED PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE agrobridge TO agrobridge_user;"
```

**3. Clone and build:**
```bash
git clone <repository-url> agrobridge-backend
cd agrobridge-backend/apps/api

# Configure environment
cp .env.example .env.production
# Edit .env.production with production values

npm ci
npm run build
npm run prisma:migrate
```

**4. Start the application:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the printed instructions
```

**5. Set up Nginx (optional but recommended):**
```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/agrobridge << 'EOF'
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/agrobridge /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**6. Add SSL:**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com
```

### Deploying Updates

```bash
cd agrobridge-backend/apps/api
git pull origin main
npm ci
npm run build
npm run prisma:migrate
pm2 reload agrobridge-api  # Zero-downtime restart
```

### Rolling Back

```bash
# Find the last working commit
git log --oneline -10

# Roll back
git checkout <commit-hash>
npm run build
pm2 restart agrobridge-api
```

### PM2 Commands

| Command | What it does |
|---------|--------------|
| `pm2 status` | Show running processes |
| `pm2 logs agrobridge-api` | View logs |
| `pm2 monit` | Real-time monitoring |
| `pm2 restart agrobridge-api` | Restart (with downtime) |
| `pm2 reload agrobridge-api` | Restart (zero downtime) |
| `pm2 stop agrobridge-api` | Stop the application |

---

## Docker Deployment

### First-Time Setup

**1. Build and start:**
```bash
git clone <repository-url> agrobridge-backend
cd agrobridge-backend/apps/api

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start everything
docker-compose up -d
```

**2. Run migrations:**
```bash
docker-compose exec api npx prisma migrate deploy
```

**3. Verify:**
```bash
curl http://localhost:3000/health
```

### Deploying Updates

```bash
git pull origin main
docker-compose build api
docker-compose up -d api
docker-compose exec api npx prisma migrate deploy
```

### Rolling Back

```bash
# List available images
docker images agrobridge-api

# Roll back to previous image
docker-compose down
docker tag agrobridge-api:previous agrobridge-api:latest
docker-compose up -d
```

### Docker Commands

| Command | What it does |
|---------|--------------|
| `docker-compose ps` | Show running containers |
| `docker-compose logs -f api` | View logs |
| `docker-compose restart api` | Restart API |
| `docker-compose down` | Stop everything |
| `docker-compose up -d --build` | Rebuild and restart |

---

## AWS ECS Deployment

For enterprise deployments with auto-scaling.

### Prerequisites

- AWS CLI configured
- ECR repository created
- RDS PostgreSQL instance
- ECS cluster (Fargate)

### Push to ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL

# Build and push
docker build -t agrobridge-api .
docker tag agrobridge-api:latest $ECR_URL/agrobridge-api:latest
docker push $ECR_URL/agrobridge-api:latest
```

### Deploy New Version

```bash
aws ecs update-service \
  --cluster agrobridge-cluster \
  --service agrobridge-api \
  --force-new-deployment
```

### Roll Back

```bash
# List task definitions
aws ecs list-task-definitions --family-prefix agrobridge-api

# Deploy previous version
aws ecs update-service \
  --cluster agrobridge-cluster \
  --service agrobridge-api \
  --task-definition agrobridge-api:PREVIOUS_REVISION
```

---

## Environment Variables

Required for production:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/agrobridge?connection_limit=20
REDIS_URL=redis://:password@host:6379
JWT_SECRET=your-32-character-secret  # Generate with: openssl rand -base64 32
CORS_ORIGINS=https://app.your-domain.com
```

See `.env.example` for all options.

---

## Post-Deployment Checklist

After deploying, verify:

```bash
# 1. Health check passes
curl https://api.your-domain.com/health
# Expected: {"status":"healthy",...}

# 2. Database connected
curl https://api.your-domain.com/health | jq .services.database
# Expected: "connected"

# 3. Authentication works
curl -X POST https://api.your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}' | jq .success
# Expected: true

# 4. SSL certificate valid
curl -I https://api.your-domain.com | grep -i strict-transport
# Expected: Strict-Transport-Security header present
```

---

## Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs agrobridge-api --lines 100
# or
docker-compose logs -f api

# Common causes:
# - DATABASE_URL incorrect
# - Missing environment variables
# - Port already in use
```

### Database connection failed

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL is running
sudo systemctl status postgresql
```

### Out of memory

```bash
# Check memory usage
pm2 monit

# Increase limit in ecosystem.config.js:
# max_memory_restart: '2G'

pm2 restart agrobridge-api
```

### SSL certificate issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) for more solutions.

---

## Maintenance

### Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/agrobridge_$(date +\%Y\%m\%d).sql.gz
```

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update
npm audit fix
```

### Log Rotation

PM2 handles log rotation automatically. Configure in `ecosystem.config.js`:
```javascript
{
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  error_file: '/var/log/agrobridge/error.log',
  out_file: '/var/log/agrobridge/out.log',
  max_size: '10M',
  retain: 7
}
```
