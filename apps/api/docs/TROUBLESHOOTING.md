# AgroBridge Backend - Troubleshooting Guide

Quick solutions to common issues.

---

## Database Issues

### Connection Failed

**Error:**
```
Error: P1001: Can't reach database server at localhost:5432
```

**Solutions:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# OR
pg_isready -h localhost -p 5432

# If not running, start it
docker start postgres
# OR
brew services start postgresql@15

# Verify connection string
echo $DATABASE_URL
# Should be: postgresql://user:password@localhost:5432/database
```

### Migration Failed

**Error:**
```
Error: Migration failed to apply cleanly to the shadow database
```

**Solutions:**
```bash
# Reset development database
npm run prisma:migrate reset

# If shadow database issue
npx prisma migrate resolve --rolled-back <migration_name>

# Force regenerate client
npm run prisma:generate
```

### Prisma Client Not Generated

**Error:**
```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
npm run prisma:generate
```

---

## Redis Issues

### Connection Refused

**Error:**
```
Error: Redis connection to localhost:6379 failed - connect ECONNREFUSED
```

**Solutions:**
```bash
# Check if Redis is running
docker ps | grep redis
# OR
redis-cli ping

# Start Redis
docker start redis
# OR
brew services start redis

# Test connection
redis-cli ping
# Expected: PONG
```

### Cache Issues

**Problem:** Stale data after updates

**Solution:**
```bash
# Clear all Redis cache
redis-cli FLUSHALL

# Clear specific key pattern
redis-cli --scan --pattern "agrobridge:*" | xargs redis-cli DEL
```

---

## Authentication Issues

### JWT Token Invalid

**Error:**
```json
{"error": "Invalid token", "code": "INVALID_TOKEN"}
```

**Causes:**
1. Token expired
2. Wrong JWT secret
3. Malformed token

**Solutions:**
```bash
# Check JWT secret matches
echo $JWT_SECRET

# Get new token
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### 2FA Not Working

**Error:**
```json
{"error": "Invalid 2FA token"}
```

**Solutions:**
1. Check device time is synced (TOTP is time-based)
2. Verify correct secret is stored
3. Try backup codes if available

---

## Build Issues

### TypeScript Errors

**Error:**
```
error TS2304: Cannot find name 'X'
```

**Solutions:**
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Regenerate Prisma types
npm run prisma:generate

# Full rebuild
rm -rf dist && npm run build
```

### Module Not Found

**Error:**
```
Error: Cannot find module './something.js'
```

**Solutions:**
```bash
# Check file exists with .ts extension
ls src/path/to/something.ts

# Ensure using .js extension in imports (ESM)
# import { X } from './something.js'  // Correct
# import { X } from './something'     // Wrong

# Rebuild
npm run build
```

### ESM Import Issues

**Error:**
```
SyntaxError: Cannot use import statement outside a module
```

**Solution:**
Ensure `package.json` has:
```json
{
  "type": "module"
}
```

---

## Performance Issues

### Slow API Responses

**Diagnosis:**
```bash
# Check with timing
time curl http://localhost:4000/api/v1/some-endpoint

# Enable debug logging
LOG_LEVEL=debug npm run dev
```

**Solutions:**
1. **Add database indexes** for slow queries
2. **Enable caching** for frequently accessed data
3. **Check N+1 queries** in Prisma

### High Memory Usage

**Diagnosis:**
```bash
# Check container memory
docker stats agrobridge-api

# Node.js memory
node --max-old-space-size=4096 dist/server.js
```

**Solutions:**
1. Reduce PDF photo limits
2. Implement pagination for large lists
3. Add connection pooling

---

## Blockchain Issues

### Transaction Failed

**Error:**
```
Error: Transaction reverted without reason
```

**Solutions:**
```bash
# Check wallet balance
# Use blockchain explorer for your network

# Check gas settings in .env
echo $BLOCKCHAIN_GAS_LIMIT
echo $BLOCKCHAIN_GAS_PRICE

# Verify RPC endpoint is responding
curl -X POST $BLOCKCHAIN_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### IPFS Upload Failed

**Error:**
```
Error: IPFS upload timeout
```

**Solutions:**
```bash
# Check Pinata API key
curl -H "Authorization: Bearer $PINATA_JWT" \
  https://api.pinata.cloud/data/testAuthentication

# IPFS failures are non-blocking
# Certificate still generates without IPFS hash
```

---

## Notification Issues

### Push Notifications Not Sending

**Diagnosis:**
```bash
# Check queue status
curl http://localhost:4000/admin/queues
# (requires admin auth)

# Check FCM credentials
echo $FIREBASE_SERVICE_ACCOUNT
```

**Solutions:**
1. Verify Firebase service account is valid
2. Check device tokens are registered
3. Verify notification preferences allow push

### Email Not Sending

**Diagnosis:**
```bash
# Check SendGrid API key
echo $SENDGRID_API_KEY

# Test email
curl -X POST http://localhost:4000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## Test Issues

### Tests Failing

**Solutions:**
```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run single test file
npm test -- tests/unit/auth.test.ts

# Clear test cache
rm -rf node_modules/.vitest
```

### Integration Tests Need Database

**Setup:**
```bash
# Create test database
createdb agrobridge_test

# Update .env.test
DATABASE_URL=postgresql://localhost:5432/agrobridge_test

# Run with test env
npm run test:integration
```

---

## Docker Issues

### Container Won't Start

**Diagnosis:**
```bash
# Check logs
docker logs agrobridge-api

# Check if port is in use
lsof -i :4000
```

**Solutions:**
```bash
# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up

# Check env file is mounted
docker exec agrobridge-api cat /app/.env
```

### Docker Compose Network Issues

**Error:**
```
Error: getaddrinfo ENOTFOUND postgres
```

**Solution:**
Use Docker network hostnames, not `localhost`:
```yaml
DATABASE_URL=postgresql://postgres:password@postgres:5432/agrobridge
REDIS_URL=redis://redis:6379
```

---

## Environment Issues

### Missing Environment Variable

**Error:**
```
Error: Environment variable X is required
```

**Solution:**
```bash
# Check all required vars are set
grep -E "^[A-Z_]+=" .env.example | cut -d= -f1 | while read var; do
  if [ -z "${!var}" ]; then echo "Missing: $var"; fi
done

# Copy from example and fill in
cp .env.example .env
```

### Wrong Environment

**Diagnosis:**
```bash
echo $NODE_ENV
# Should be: development, staging, or production
```

**Solution:**
```bash
# Set correct environment
export NODE_ENV=development
npm run dev
```

---

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Everything broken | `rm -rf node_modules && npm install` |
| Database issues | `npm run prisma:migrate reset` |
| Type errors | `npm run prisma:generate` |
| Cache stale | `redis-cli FLUSHALL` |
| Port in use | `lsof -ti:4000 | xargs kill -9` |
| Tests failing | `npm run test:ci` |

---

## Getting More Help

1. **Check logs:**
   ```bash
   tail -f logs/app.log
   docker logs -f agrobridge-api
   ```

2. **Enable debug mode:**
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

3. **Check Sentry** for production errors

4. **Ask in Slack** #backend-support

---

*Last updated: December 25, 2025*
