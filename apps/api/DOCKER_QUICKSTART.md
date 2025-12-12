# 🐳 AgroBridge Docker Quick Start Guide

## 🚀 First Time Setup

### 1. Start Docker Desktop
Ensure Docker Desktop is running (look for green status icon)

### 2. Build the Image
```bash
# Using the automated build script (recommended)
./scripts/docker-build.sh

# Or manually
docker build -t agrobridge-api:latest .
```

### 3. Start All Services
```bash
docker-compose up -d
```

### 4. Run Database Migrations
```bash
docker-compose exec api npx prisma migrate deploy \
  --schema=./src/infrastructure/database/prisma/schema.prisma
```

### 5. Verify Everything is Running
```bash
# Check service status
docker-compose ps

# Test API health
curl http://localhost:3000/health

# Should return: {"status":"healthy", ...}
```

---

## 📋 Common Commands

### Service Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart api

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f api
docker-compose logs -f postgres --tail=100

# Check service status
docker-compose ps
```

### Database Operations
```bash
# Run migrations
docker-compose exec api npx prisma migrate deploy \
  --schema=./src/infrastructure/database/prisma/schema.prisma

# Access PostgreSQL shell
docker-compose exec postgres psql -U agrobridge -d agrobridge_dev

# Backup database
docker-compose exec postgres pg_dump -U agrobridge agrobridge_dev > backup.sql

# Restore database
docker-compose exec -T postgres psql -U agrobridge -d agrobridge_dev < backup.sql
```

### Development Tools
```bash
# Start Prisma Studio (database GUI)
docker-compose --profile tools up -d prisma-studio
# Open: http://localhost:5555

# Access container shell
docker-compose exec api sh

# Access Redis CLI
docker-compose exec redis redis-cli

# Run npm commands inside container
docker-compose exec api npm run test
```

### Image Management
```bash
# Rebuild image without cache
docker-compose build --no-cache

# Rebuild and restart services
docker-compose up -d --build

# View image details
docker images agrobridge-api:latest

# View image layers
docker history agrobridge-api:latest

# Remove unused images
docker image prune -a
```

### Cleanup
```bash
# Stop and remove containers (data persists)
docker-compose down

# Stop, remove containers AND volumes (⚠️ DATA LOSS)
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a --volumes
```

---

## 🔍 Troubleshooting

### Port Already in Use
If you see "port is already allocated":

```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
# ports:
#   - "3001:3000"  # Use host port 3001 instead
```

### Container Won't Start
```bash
# Check container logs
docker-compose logs api

# Check for errors
docker-compose logs api | grep -i error

# Restart with fresh build
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Issues
```bash
# Verify Postgres is healthy
docker-compose ps postgres

# Check Postgres logs
docker-compose logs postgres

# Test connection manually
docker-compose exec postgres psql -U agrobridge -d agrobridge_dev -c "SELECT 1;"
```

### Build Failures
```bash
# Check Prisma schema exists
ls -la src/infrastructure/database/prisma/schema.prisma

# Verify Docker is running
docker ps

# Build with verbose output
docker build --progress=plain -t agrobridge-api:latest .
```

---

## 🎯 Service URLs

- **API**: http://localhost:3000
- **API Health**: http://localhost:3000/health
- **PostgreSQL**: localhost:5433 (user: agrobridge, db: agrobridge_dev)
- **Redis**: localhost:6380
- **Prisma Studio**: http://localhost:5555 (when started with `--profile tools`)

---

## 📊 Monitoring

### Check Resource Usage
```bash
# Real-time stats
docker stats

# One-time snapshot
docker stats --no-stream

# Specific container
docker stats agrobridge-api --no-stream
```

### Health Checks
```bash
# API health
curl http://localhost:3000/health

# Postgres health
docker-compose exec postgres pg_isready -U agrobridge

# Redis health
docker-compose exec redis redis-cli ping
```

---

## 🔐 Security Notes

1. **Change default passwords** in production
2. **Use strong JWT_SECRET** (generate: `openssl rand -base64 32`)
3. **Never commit** `.env.docker` to version control
4. **Update base images** regularly for security patches
5. **Scan images** for vulnerabilities: `docker scan agrobridge-api:latest`

---

## 📚 Additional Resources

- **Dockerfile**: `/apps/api/Dockerfile` (268 lines, 3-stage build)
- **Compose File**: `/apps/api/docker-compose.yml` (409 lines, full orchestration)
- **Build Script**: `/apps/api/scripts/docker-build.sh` (automated builds)
- **Environment Template**: `/apps/api/.env.docker.example` (configuration reference)

---

## 🆘 Need Help?

```bash
# View this guide
cat DOCKER_QUICKSTART.md

# View compose file help
docker-compose --help

# View available services
docker-compose config --services

# Validate compose file
docker-compose config
```

---

## ✨ Docker Containerization Implementation
**Author**: Alejandro Navarro Ayala - CEO & Senior Developer
**Last Updated**: December 2, 2025
