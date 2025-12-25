# AgroBridge Backend - Environment Variables Reference

Complete reference for all environment variables.

---

## Required Variables

### Application

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development`, `staging`, `production` |
| `PORT` | Server port | `4000` |
| `API_BASE_URL` | Public API URL | `https://api.agrobridge.com.mx` |

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |

### Authentication

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (RS256 private key) | Base64 encoded key |
| `JWT_PUBLIC_KEY` | JWT verification key (RS256 public key) | Base64 encoded key |
| `JWT_EXPIRES_IN` | Access token expiry | `7d` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiry | `30d` |

### Blockchain

| Variable | Description | Example |
|----------|-------------|---------|
| `BLOCKCHAIN_NETWORK` | Network name | `polygon-mainnet` |
| `BLOCKCHAIN_RPC_URL` | RPC endpoint | `https://polygon-rpc.com` |
| `BLOCKCHAIN_PRIVATE_KEY` | Wallet private key | `0x...` |
| `BLOCKCHAIN_CONTRACT_ADDRESS` | Smart contract address | `0x...` |

---

## Optional Variables

### AWS Services

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `S3_BUCKET` | S3 bucket name | - |
| `S3_ENDPOINT` | Custom S3 endpoint | - |

### Notifications

| Variable | Description | Default |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key | - |
| `SENDGRID_FROM_EMAIL` | Sender email | - |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | - |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | - |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON | - |

### Monitoring

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry DSN | - |
| `SENTRY_ENVIRONMENT` | Sentry environment | `NODE_ENV` value |
| `LOG_LEVEL` | Logging verbosity | `info` |

### IPFS/Pinata

| Variable | Description | Default |
|----------|-------------|---------|
| `PINATA_API_KEY` | Pinata API key | - |
| `PINATA_API_SECRET` | Pinata API secret | - |
| `PINATA_JWT` | Pinata JWT | - |

### OAuth Providers

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - |

### Payments

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |
| `MERCADOPAGO_ACCESS_TOKEN` | MercadoPago token | - |

### WhatsApp

| Variable | Description | Default |
|----------|-------------|---------|
| `META_WHATSAPP_TOKEN` | Meta WhatsApp token | - |
| `META_WHATSAPP_PHONE_ID` | WhatsApp phone ID | - |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verify token | - |

### Features

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_SWAGGER` | Enable API docs | `true` |
| `ENABLE_GRAPHQL` | Enable GraphQL | `true` |
| `COLLECTIONS_ENABLED` | Enable collections cron | `false` |

---

## Environment Files

### Local Development (`.env`)

```bash
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/agrobridge_dev
REDIS_URL=redis://localhost:6379

# Auth (generate with: npm run generate:keys)
JWT_SECRET=<base64-encoded-private-key>
JWT_PUBLIC_KEY=<base64-encoded-public-key>
JWT_EXPIRES_IN=7d

# Blockchain (testnet)
BLOCKCHAIN_NETWORK=polygon-amoy
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology

# Logging
LOG_LEVEL=debug
ENABLE_SWAGGER=true
```

### Staging (`.env.staging`)

```bash
NODE_ENV=staging
PORT=4000

DATABASE_URL=<RDS connection string>
REDIS_URL=<ElastiCache connection string>

# Full production-like config
SENTRY_DSN=<staging sentry dsn>
```

### Production

Production uses AWS Secrets Manager. Secrets are loaded at runtime:

```typescript
// src/infrastructure/config/secrets.ts
const secrets = await getSecrets('agrobridge-production');
```

---

## Generating Keys

### JWT RS256 Keys

```bash
# Generate private key
openssl genrsa -out jwtRS256.key 2048

# Generate public key
openssl rsa -in jwtRS256.key -pubout -out jwtRS256.key.pub

# Base64 encode for .env
JWT_SECRET=$(base64 -i jwtRS256.key)
JWT_PUBLIC_KEY=$(base64 -i jwtRS256.key.pub)

# Or use the script
npm run generate:keys
```

---

## Validation

Environment variables are validated at startup:

```typescript
// src/config/env.ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(1),
  // ...
});

export const env = validateEnv();
```

If required variables are missing, the server exits with an error.

---

*Last updated: December 25, 2025*
