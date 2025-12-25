# Security

Security features implemented in the AgroBridge API.

---

## Quick Reference

| Feature | Status | Implementation |
|---------|--------|----------------|
| Authentication | JWT + bcrypt | `src/presentation/middlewares/auth.middleware.ts` |
| Rate limiting | Per-IP limits | `src/infrastructure/http/middleware/rate-limiter.middleware.ts` |
| Input validation | Zod schemas | `src/presentation/validators/` |
| SQL injection | Prevented | Prisma ORM parameterized queries |
| XSS | Prevented | Input sanitization + Helmet headers |
| CORS | Configured | Whitelist-based, no wildcards |
| HTTPS | Required | Enforced via HSTS header |

---

## Authentication

### How It Works

1. User logs in with email/password
2. Password verified against bcrypt hash (cost factor 12)
3. JWT token issued (expires in 7 days)
4. Token required in `Authorization: Bearer <token>` header

### Password Requirements

- Minimum 8 characters
- At least 1 uppercase (A-Z)
- At least 1 lowercase (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)

### Token Expiration

| Token | Expiration |
|-------|------------|
| Access token | 7 days |
| Refresh token | 30 days |

---

## Rate Limiting

Protects against brute force and DDoS attacks.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 requests | 15 minutes |
| `/auth/register` | 3 requests | 1 hour |
| All other endpoints | 100 requests | 15 minutes |

**When limited:**
```json
{"error": "Too many requests", "retryAfter": 900}
```

---

## Security Headers

All responses include these headers via Helmet:

| Header | Value | Protection |
|--------|-------|------------|
| `Strict-Transport-Security` | max-age=31536000 | Forces HTTPS |
| `X-Frame-Options` | DENY | Clickjacking |
| `X-Content-Type-Options` | nosniff | MIME sniffing |
| `X-XSS-Protection` | 1; mode=block | XSS filter |
| `Content-Security-Policy` | default-src 'self' | XSS/injection |

**Verify headers:**
```bash
curl -I https://api.your-domain.com/health | grep -E "X-Frame|X-Content|Strict"
```

---

## CORS Configuration

Only whitelisted origins can make requests.

**Allowed origins (production):**
- `https://app.agrobridge.io`
- `https://admin.agrobridge.io`

**Not allowed:**
- Wildcards (`*`)
- `localhost` in production

Configure in `.env`:
```bash
CORS_ORIGINS=https://app.agrobridge.io,https://admin.agrobridge.io
```

---

## Input Validation

All input validated with Zod before processing.

**Protections:**
- SQL injection: Prisma parameterized queries
- XSS: HTML stripped, special chars escaped
- Path traversal: Paths validated
- Email: RFC 5322 format enforced

**Example validation:**
```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});
```

---

## Database Security

| Feature | Implementation |
|---------|----------------|
| SQL injection | Prisma parameterized queries |
| Connection pooling | `connection_limit=20` |
| SSL/TLS | Required in production |
| Credentials | Environment variables only |

**Connection string format:**
```bash
postgresql://user:pass@host:5432/db?connection_limit=20&sslmode=require
```

---

## Secrets Management

### Required Secrets

| Secret | Description | Generation |
|--------|-------------|------------|
| `JWT_SECRET` | Token signing | `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL connection | From your DB provider |
| `REDIS_URL` | Redis connection | From your Redis provider |

### Best Practices

- Never commit secrets to git
- Use `.env` files (gitignored)
- Rotate `JWT_SECRET` quarterly
- Use AWS Secrets Manager in production

**Check for secrets in code:**
```bash
grep -r "password\|secret\|key" src/ --exclude-dir=node_modules
```

---

## Security Checklist

### Before Deployment

- [ ] `JWT_SECRET` is 32+ characters
- [ ] `DATABASE_URL` uses SSL (`sslmode=require`)
- [ ] `CORS_ORIGINS` has no wildcards
- [ ] `.env` files in `.gitignore`
- [ ] `npm audit` shows no critical vulnerabilities

### After Deployment

- [ ] HTTPS working (check for lock icon)
- [ ] Security headers present (`curl -I`)
- [ ] Rate limiting working (hit endpoint 6+ times)
- [ ] Logs not exposing secrets

---

## Incident Response

### If You Suspect a Breach

1. **Contain**: Rotate `JWT_SECRET` immediately
   ```bash
   # Generate new secret
   openssl rand -base64 32
   # Update .env and restart
   pm2 restart agrobridge-api
   ```

2. **Investigate**: Check logs
   ```bash
   pm2 logs agrobridge-api --lines 1000 | grep -i "auth\|error"
   ```

3. **Notify**: Email security@agrobridge.io

### If Rate Limited Legitimately

Adjust limits in `.env`:
```bash
RATE_LIMIT_MAX_REQUESTS=200  # Increase from 100
```

### If JWT Secret Compromised

```bash
# 1. Generate new secret
openssl rand -base64 32

# 2. Update .env.production
JWT_SECRET=new-secret-here

# 3. Restart (invalidates all existing tokens)
pm2 restart agrobridge-api
```

---

## Vulnerability Management

### Weekly

```bash
npm audit
npm audit fix
```

### Monthly

```bash
npm outdated
npm update
```

### If Critical Vulnerability Found

1. Check if exploitable: `npm audit --json | jq '.vulnerabilities | to_entries[] | select(.value.severity == "critical")'`
2. Fix immediately: `npm audit fix --force` (test afterward)
3. Redeploy

---

## Compliance

### GDPR

| Right | Endpoint |
|-------|----------|
| Access | `GET /api/v1/auth/me` |
| Rectification | `PUT /api/v1/auth/me` |
| Erasure | `DELETE /api/v1/auth/me` |
| Portability | `GET /api/v1/users/export` |

### SOC 2

- Audit logs: 90-day retention
- Access controls: Role-based (RBAC)
- Encryption: TLS in transit, AES at rest (database)

---

## Reporting Security Issues

**Email:** security@agrobridge.io
**Response time:** < 24 hours

We appreciate responsible disclosure. Do not publicly disclose until we've had 90 days to fix.
