# Environment Variables Reference

Complete reference for all **128 environment variables** used in AgroBridge API.

---

## Quick Setup

**Development** (minimum required):
```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/agrobridge_dev
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_PRIVATE_KEY_PATH=./jwtRS256.key
JWT_PUBLIC_KEY_PATH=./jwtRS256.key.pub
```

**Production** (add these):
```bash
NODE_ENV=production
SENTRY_DSN=https://xxx@sentry.io/xxx
ENCRYPTION_KEY=$(openssl rand -base64 32)
ENCRYPTION_SALT=$(openssl rand -base64 16)
```

---

## Variable Categories

| Category | Count | Required |
|----------|-------|----------|
| [Application](#application) | 8 | 2 |
| [Database](#database) | 7 | 1 |
| [Redis](#redis) | 6 | 2 |
| [Authentication](#authentication) | 7 | 2 |
| [Security](#security) | 6 | 2 |
| [Blockchain](#blockchain) | 8 | 0 |
| [AWS Services](#aws-services) | 10 | 0 |
| [Notifications](#notifications) | 19 | 0 |
| [Payments](#payments) | 8 | 0 |
| [WhatsApp](#whatsapp) | 5 | 0 |
| [Monitoring](#monitoring) | 12 | 0 |
| [Feature Flags](#feature-flags) | 6 | 0 |
| [Fintech](#fintech) | 10 | 0 |
| [External APIs](#external-apis) | 8 | 0 |
| [Queue Configuration](#queue-configuration) | 5 | 0 |
| [Virus Scanning](#virus-scanning) | 4 | 0 |

---

## Application

### NODE_ENV
- **Description**: Application environment mode. Controls logging verbosity, error detail exposure, security hardening, and feature flags.
- **Type**: Enum
- **Required**: Yes
- **Values**: `development`, `staging`, `production`
- **Default**: `development`
- **Example**: `NODE_ENV=production`
- **Used by**:
  - `src/server.ts:48` - Startup logging
  - `src/infrastructure/security/helmet.config.ts:11` - Security headers
  - `src/infrastructure/graphql/server.ts:51` - GraphQL playground
  - `src/infrastructure/auth/ApiKeyService.ts:82` - Key validation strictness
- **Production notes**:
  - Must be `production` in prod environments
  - Disables GraphQL playground
  - Enables strict security headers
  - Hides detailed error messages from clients

### PORT
- **Description**: HTTP server port.
- **Type**: Number
- **Required**: No
- **Default**: `4000`
- **Example**: `PORT=3000`
- **Used by**: `src/server.ts`
- **Notes**: If port is in use, server will fail to start. Check with `lsof -i :4000`.

### API_VERSION
- **Description**: Current API version string for versioning headers.
- **Type**: String
- **Required**: No
- **Default**: `v1`
- **Example**: `API_VERSION=v2`
- **Used by**: `src/infrastructure/http/middleware/apiVersioning.middleware.ts`

### API_DOMAIN
- **Description**: Primary API domain for CORS and security headers.
- **Type**: String
- **Required**: No (production: Yes)
- **Default**: `api.agrobridgeint.com`
- **Example**: `API_DOMAIN=api.agrobridge.io`
- **Used by**: `src/infrastructure/security/helmet.config.ts:12`

### FRONTEND_DOMAIN
- **Description**: Frontend application domain for CORS configuration.
- **Type**: String
- **Required**: No
- **Default**: `agrobridgeint.com`
- **Example**: `FRONTEND_DOMAIN=app.agrobridge.io`
- **Used by**: `src/infrastructure/security/helmet.config.ts:14`

### FRONTEND_URL
- **Description**: Full frontend URL for redirects after OAuth, email verification links.
- **Type**: URL
- **Required**: Yes (if using OAuth)
- **Default**: `http://localhost:3000`
- **Example**: `FRONTEND_URL=https://app.agrobridge.io`
- **Used by**:
  - `src/presentation/routes/auth.routes.ts:372` - OAuth callback redirects
  - `src/presentation/routes/payment.routes.ts:625` - Payment redirects

### APP_BASE_URL
- **Description**: Base URL for the API, used in emails, webhooks, and notifications.
- **Type**: URL
- **Required**: No
- **Default**: `https://api.agrobridge.io`
- **Example**: `APP_BASE_URL=https://api.agrobridge.com.mx`
- **Used by**:
  - `src/modules/whatsapp-bot/services/blockchain-notification.service.ts:35`
  - `src/presentation/routes/referrals.routes.ts:191`

### APP_URL
- **Description**: Application URL for email templates and notifications.
- **Type**: URL
- **Required**: No
- **Default**: `https://app.agrobridge.io`
- **Example**: `APP_URL=https://app.agrobridge.com.mx`
- **Used by**:
  - `src/infrastructure/notifications/services/EmailService.ts:50`
  - `src/infrastructure/notifications/services/SMSService.ts:58`

---

## Database

### DATABASE_URL
- **Description**: PostgreSQL connection string with Prisma connection pool options.
- **Type**: URL (PostgreSQL)
- **Required**: Yes
- **Format**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&connection_limit=20`
- **Example**:
  ```
  # Development
  DATABASE_URL=postgresql://postgres:password@localhost:5432/agrobridge_dev

  # Production (with pooling)
  DATABASE_URL=postgresql://user:pass@rds-host:5432/agrobridge?connection_limit=20&pool_timeout=30&sslmode=require
  ```
- **Production notes**:
  - Use `sslmode=require` for RDS/Cloud SQL
  - Set `connection_limit` to number of server instances × 5
  - Never commit to git

### DB_POOL_SIZE
- **Description**: Maximum database connections per server instance.
- **Type**: Number
- **Required**: No
- **Default**: `10`
- **Example**: `DB_POOL_SIZE=20`
- **Notes**: Total connections = DB_POOL_SIZE × number of server instances. Don't exceed database max_connections.

### DB_CONNECT_TIMEOUT
- **Description**: Database connection timeout in milliseconds.
- **Type**: Number
- **Required**: No
- **Default**: `10000` (10 seconds)
- **Example**: `DB_CONNECT_TIMEOUT=5000`

### DB_QUERY_TIMEOUT
- **Description**: Query execution timeout in milliseconds.
- **Type**: Number
- **Required**: No
- **Default**: `30000` (30 seconds)
- **Example**: `DB_QUERY_TIMEOUT=60000`

### DB_RETRIES
- **Description**: Number of connection retry attempts on failure.
- **Type**: Number
- **Required**: No
- **Default**: `3`
- **Example**: `DB_RETRIES=5`

### DB_RETRY_DELAY
- **Description**: Delay between connection retries in milliseconds.
- **Type**: Number
- **Required**: No
- **Default**: `1000` (1 second)
- **Example**: `DB_RETRY_DELAY=2000`

---

## Redis

### REDIS_HOST
- **Description**: Redis server hostname.
- **Type**: String
- **Required**: Yes
- **Default**: `localhost`
- **Example**: `REDIS_HOST=redis.internal.agrobridge.io`
- **Used by**: `src/infrastructure/queue/QueueService.ts:221`

### REDIS_PORT
- **Description**: Redis server port.
- **Type**: Number
- **Required**: Yes
- **Default**: `6379`
- **Example**: `REDIS_PORT=6379`
- **Used by**: `src/infrastructure/queue/QueueService.ts:222`

### REDIS_PASSWORD
- **Description**: Redis authentication password.
- **Type**: String
- **Required**: No (production: Yes)
- **Default**: None
- **Example**: `REDIS_PASSWORD=your-secure-redis-password`
- **Used by**: `src/infrastructure/queue/QueueService.ts:223`
- **Production notes**: Always set in production. ElastiCache provides AUTH token.

### REDIS_DB
- **Description**: Redis database number for general caching.
- **Type**: Number (0-15)
- **Required**: No
- **Default**: `0`
- **Example**: `REDIS_DB=0`

### REDIS_QUEUE_DB
- **Description**: Redis database number for Bull queues. Separate from cache to isolate job data.
- **Type**: Number (0-15)
- **Required**: No
- **Default**: `1`
- **Example**: `REDIS_QUEUE_DB=1`
- **Used by**: `src/infrastructure/queue/QueueService.ts:224`

### REDIS_URL
- **Description**: Full Redis connection URL (alternative to HOST/PORT/PASSWORD).
- **Type**: URL
- **Required**: No
- **Format**: `redis://[:password@]host:port[/db]`
- **Example**: `REDIS_URL=redis://:password@redis.host:6379/0`

---

## Authentication

### JWT_SECRET
- **Description**: Secret key for JWT signing (symmetric HS256). Deprecated in favor of RSA keys.
- **Type**: String
- **Required**: No (use RSA keys instead)
- **Example**: `JWT_SECRET=your-32-character-minimum-secret`
- **Security**: Minimum 32 characters. Generate with `openssl rand -base64 32`.

### JWT_PRIVATE_KEY_PATH
- **Description**: Path to RSA private key file for JWT signing (RS256).
- **Type**: File path
- **Required**: Yes
- **Default**: `./jwtRS256.key`
- **Example**: `JWT_PRIVATE_KEY_PATH=/etc/secrets/jwt.key`
- **Used by**: `src/infrastructure/auth/oauth/OAuthService.ts:27`
- **Generate**: `openssl genrsa -out jwtRS256.key 2048`

### JWT_PUBLIC_KEY_PATH
- **Description**: Path to RSA public key file for JWT verification.
- **Type**: File path
- **Required**: Yes
- **Default**: `./jwtRS256.key.pub`
- **Example**: `JWT_PUBLIC_KEY_PATH=/etc/secrets/jwt.pub`
- **Used by**: `src/presentation/middlewares/auth.middleware.ts:14`
- **Generate**: `openssl rsa -in jwtRS256.key -pubout -out jwtRS256.key.pub`

### JWT_ACCESS_TOKEN_TTL
- **Description**: Access token expiration time.
- **Type**: String (time expression)
- **Required**: No
- **Default**: `15m`
- **Example**: `JWT_ACCESS_TOKEN_TTL=1h`
- **Used by**: `src/infrastructure/auth/oauth/OAuthService.ts:37`
- **Values**: `15m`, `1h`, `7d`, etc.

### JWT_REFRESH_TOKEN_TTL
- **Description**: Refresh token expiration time.
- **Type**: String (time expression)
- **Required**: No
- **Default**: `7d`
- **Example**: `JWT_REFRESH_TOKEN_TTL=30d`
- **Used by**: `src/infrastructure/auth/oauth/OAuthService.ts:38`

### TWO_FACTOR_ENCRYPTION_KEY
- **Description**: AES-256 key for encrypting 2FA secrets at rest.
- **Type**: String (32 bytes base64)
- **Required**: Yes (if 2FA enabled)
- **Example**: `TWO_FACTOR_ENCRYPTION_KEY=$(openssl rand -base64 32)`
- **Used by**: `src/infrastructure/auth/TwoFactorService.ts:148`
- **Security**: Never log or expose. Rotate annually.

---

## Security

### ENCRYPTION_KEY
- **Description**: Master encryption key for sensitive data at rest (PII, API keys).
- **Type**: String (32 bytes base64)
- **Required**: Yes (production)
- **Example**: `ENCRYPTION_KEY=$(openssl rand -base64 32)`
- **Used by**: `src/infrastructure/security/encryption.service.ts:23`
- **Security**: Critical secret. Store in AWS Secrets Manager in production.

### ENCRYPTION_SALT
- **Description**: Salt for key derivation functions.
- **Type**: String (16 bytes base64)
- **Required**: Yes (production)
- **Example**: `ENCRYPTION_SALT=$(openssl rand -base64 16)`
- **Used by**: `src/infrastructure/security/encryption.service.ts:48`

### CORS_ORIGIN
- **Description**: Allowed CORS origin (single origin mode).
- **Type**: URL
- **Required**: No
- **Example**: `CORS_ORIGIN=https://app.agrobridge.io`
- **Used by**: `src/infrastructure/security/vulnerability-scanner.ts:321`

### ALLOWED_ORIGINS
- **Description**: Comma-separated list of allowed CORS origins.
- **Type**: String (comma-separated URLs)
- **Required**: No
- **Default**: `http://localhost:3000`
- **Example**: `ALLOWED_ORIGINS=https://app.agrobridge.io,https://admin.agrobridge.io`
- **Production notes**: Never use `*` in production.

### RATE_LIMIT_ENABLED
- **Description**: Enable/disable rate limiting globally.
- **Type**: Boolean
- **Required**: No
- **Default**: `true`
- **Example**: `RATE_LIMIT_ENABLED=true`
- **Used by**: `src/infrastructure/security/vulnerability-scanner.ts:334`
- **Warning**: Never disable in production.

### CDN_DOMAIN
- **Description**: CDN domain for static assets and uploaded files.
- **Type**: String
- **Required**: No
- **Default**: `cdn.agrobridgeint.com`
- **Example**: `CDN_DOMAIN=cdn.agrobridge.io`
- **Used by**: `src/infrastructure/security/helmet.config.ts:13`

---

## Blockchain

### BLOCKCHAIN_ENABLED
- **Description**: Enable blockchain features (certificate anchoring, NFTs).
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Example**: `BLOCKCHAIN_ENABLED=true`
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:34`

### BLOCKCHAIN_RPC_URL
- **Description**: Ethereum/Polygon JSON-RPC endpoint.
- **Type**: URL
- **Required**: Yes (if blockchain enabled)
- **Example**:
  ```
  # Polygon Mainnet
  BLOCKCHAIN_RPC_URL=https://polygon-rpc.com

  # Alchemy
  BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
  ```
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:35`

### BLOCKCHAIN_PRIVATE_KEY
- **Description**: Wallet private key for signing transactions.
- **Type**: String (hex, 64 chars)
- **Required**: Yes (if blockchain enabled)
- **Example**: `BLOCKCHAIN_PRIVATE_KEY=0xabcdef...` (64 hex chars)
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:37`
- **Security**: Critical secret. Never commit. Use AWS Secrets Manager.

### BLOCKCHAIN_VERIFICATION_ENABLED
- **Description**: Enable on-chain certificate verification.
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Example**: `BLOCKCHAIN_VERIFICATION_ENABLED=true`

### TRACEABILITY_CONTRACT_ADDRESS
- **Description**: Deployed traceability registry smart contract address.
- **Type**: String (Ethereum address)
- **Required**: Yes (if blockchain enabled)
- **Example**: `TRACEABILITY_CONTRACT_ADDRESS=0x1234...abcd`

### REFERRAL_CONTRACT_ADDRESS
- **Description**: Deployed referral rewards smart contract address.
- **Type**: String (Ethereum address)
- **Required**: No
- **Example**: `REFERRAL_CONTRACT_ADDRESS=0x5678...efgh`

### INVOICE_REGISTRY_CONTRACT
- **Description**: Deployed invoice registry smart contract address.
- **Type**: String (Ethereum address)
- **Required**: No
- **Example**: `INVOICE_REGISTRY_CONTRACT=0x9abc...ijkl`
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:36`

---

## AWS Services

### AWS_REGION
- **Description**: Default AWS region for all services.
- **Type**: String (AWS region code)
- **Required**: Yes (if using AWS)
- **Default**: `us-east-1`
- **Example**: `AWS_REGION=us-west-2`

### AWS_ACCESS_KEY_ID
- **Description**: AWS IAM access key.
- **Type**: String
- **Required**: Yes (if using AWS, or use IAM role)
- **Example**: `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`
- **Notes**: Prefer IAM roles on EC2/ECS over access keys.

### AWS_SECRET_ACCESS_KEY
- **Description**: AWS IAM secret key.
- **Type**: String
- **Required**: Yes (if using access key)
- **Security**: Never commit to git.

### AWS_S3_BUCKET
- **Description**: S3 bucket name for file uploads.
- **Type**: String
- **Required**: Yes (if file uploads enabled)
- **Example**: `AWS_S3_BUCKET=agrobridge-uploads-prod`

### S3_BUCKET
- **Description**: Alias for AWS_S3_BUCKET.
- **Type**: String
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:42`

### S3_BASE_URL
- **Description**: Custom S3 endpoint URL (for S3-compatible storage like MinIO).
- **Type**: URL
- **Required**: No
- **Example**: `S3_BASE_URL=https://minio.internal:9000`

### AWS_CLOUDFRONT_DOMAIN
- **Description**: CloudFront distribution domain for CDN-served assets.
- **Type**: String
- **Required**: No
- **Example**: `AWS_CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net`

### AWS_SECRET_NAME
- **Description**: AWS Secrets Manager secret name for loading secrets.
- **Type**: String
- **Required**: No
- **Example**: `AWS_SECRET_NAME=agrobridge/production/api`

### AWS_SES_REGION
- **Description**: AWS region for SES email sending.
- **Type**: String
- **Required**: No
- **Default**: Same as AWS_REGION
- **Example**: `AWS_SES_REGION=us-east-1`

### AWS_SES_FROM_EMAIL
- **Description**: Verified SES sender email address.
- **Type**: Email
- **Required**: Yes (if using SES)
- **Example**: `AWS_SES_FROM_EMAIL=noreply@agrobridge.io`

### AWS_SES_CONFIGURATION_SET
- **Description**: SES configuration set for tracking and reputation.
- **Type**: String
- **Required**: No
- **Example**: `AWS_SES_CONFIGURATION_SET=agrobridge-tracking`

### AWS_XRAY_DAEMON_ADDRESS
- **Description**: X-Ray daemon address for distributed tracing.
- **Type**: String
- **Required**: No
- **Example**: `AWS_XRAY_DAEMON_ADDRESS=127.0.0.1:2000`

---

## Notifications

### SENDGRID_API_KEY
- **Description**: SendGrid API key for transactional emails.
- **Type**: String
- **Required**: Yes (if email enabled)
- **Example**: `SENDGRID_API_KEY=SG.xxx`
- **Used by**: `src/infrastructure/notifications/services/EmailService.ts:70`

### SENDGRID_FROM_EMAIL
- **Description**: Verified SendGrid sender email.
- **Type**: Email
- **Required**: Yes (if using SendGrid)
- **Default**: `notifications@agrobridge.io`
- **Used by**: `src/infrastructure/notifications/services/EmailService.ts:48`

### SENDGRID_FROM_NAME
- **Description**: Display name for email sender.
- **Type**: String
- **Required**: No
- **Default**: `AgroBridge`
- **Used by**: `src/infrastructure/notifications/services/EmailService.ts:49`

### EMAIL_PRIMARY_PROVIDER
- **Description**: Primary email provider (failover available).
- **Type**: Enum
- **Required**: No
- **Default**: `ses`
- **Values**: `ses`, `sendgrid`
- **Used by**: `src/infrastructure/notifications/services/ResilientEmailService.ts:90`

### TWILIO_ACCOUNT_SID
- **Description**: Twilio account SID for SMS and WhatsApp.
- **Type**: String
- **Required**: Yes (if SMS enabled)
- **Example**: `TWILIO_ACCOUNT_SID=ACxxx`
- **Used by**: `src/infrastructure/notifications/services/SMSService.ts:78`

### TWILIO_AUTH_TOKEN
- **Description**: Twilio authentication token.
- **Type**: String
- **Required**: Yes (if SMS enabled)
- **Used by**: `src/infrastructure/notifications/services/SMSService.ts:79`

### TWILIO_PHONE_NUMBER
- **Description**: Twilio phone number for SMS sending.
- **Type**: Phone (E.164 format)
- **Required**: Yes (if SMS enabled)
- **Example**: `TWILIO_PHONE_NUMBER=+15551234567`
- **Used by**: `src/infrastructure/notifications/services/SMSService.ts:56`

### TWILIO_WHATSAPP_NUMBER
- **Description**: Twilio WhatsApp-enabled phone number.
- **Type**: Phone (E.164 format)
- **Required**: No
- **Example**: `TWILIO_WHATSAPP_NUMBER=+15559876543`
- **Used by**: `src/infrastructure/notifications/services/SMSService.ts:57`

### FIREBASE_PROJECT_ID
- **Description**: Firebase project ID for push notifications.
- **Type**: String
- **Required**: Yes (if push enabled)
- **Example**: `FIREBASE_PROJECT_ID=agrobridge-prod`
- **Used by**: `src/infrastructure/notifications/services/FCMService.ts:74`

### FIREBASE_CLIENT_EMAIL
- **Description**: Firebase service account email.
- **Type**: Email
- **Required**: Yes (if push enabled)
- **Used by**: `src/infrastructure/notifications/services/FCMService.ts:75`

### FIREBASE_PRIVATE_KEY
- **Description**: Firebase service account private key (escaped newlines).
- **Type**: String
- **Required**: Yes (if push enabled)
- **Example**: `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ..."`
- **Used by**: `src/infrastructure/notifications/services/FCMService.ts:76`
- **Notes**: Must escape newlines as `\n` in .env file.

### APNS_PRODUCTION
- **Description**: Use APNs production or sandbox environment.
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Used by**: `src/infrastructure/notifications/services/APNsService.ts:50`

### APNS_BUNDLE_ID
- **Description**: iOS app bundle identifier for APNs.
- **Type**: String
- **Required**: Yes (if iOS push enabled)
- **Default**: `com.agrobridge.app`
- **Used by**: `src/infrastructure/notifications/services/APNsService.ts:51`

### APNS_KEY_PATH
- **Description**: Path to APNs authentication key (.p8 file).
- **Type**: File path
- **Required**: Yes (if iOS push enabled)
- **Used by**: `src/infrastructure/notifications/services/APNsService.ts:72`

### APNS_KEY_ID
- **Description**: APNs key ID (from Apple Developer Portal).
- **Type**: String
- **Required**: Yes (if iOS push enabled)
- **Used by**: `src/infrastructure/notifications/services/APNsService.ts:73`

### APNS_TEAM_ID
- **Description**: Apple Developer Team ID.
- **Type**: String
- **Required**: Yes (if iOS push enabled)
- **Used by**: `src/infrastructure/notifications/services/APNsService.ts:74`

### NOTIFICATION_RATE_LIMIT
- **Description**: Maximum notifications per user per minute.
- **Type**: Number
- **Required**: No
- **Default**: `60`
- **Example**: `NOTIFICATION_RATE_LIMIT=30`

### NOTIFICATION_RETRY_ATTEMPTS
- **Description**: Retry attempts for failed notifications.
- **Type**: Number
- **Required**: No
- **Default**: `3`

### NOTIFICATION_RETRY_DELAY
- **Description**: Delay between notification retries in milliseconds.
- **Type**: Number
- **Required**: No
- **Default**: `5000`

---

## Payments

### STRIPE_SECRET_KEY
- **Description**: Stripe secret API key.
- **Type**: String
- **Required**: Yes (if Stripe enabled)
- **Example**: `STRIPE_SECRET_KEY=sk_live_xxx`
- **Used by**: `src/infrastructure/payment/providers/StripeProvider.ts:82`

### STRIPE_WEBHOOK_SECRET
- **Description**: Stripe webhook signing secret.
- **Type**: String
- **Required**: Yes (if webhooks enabled)
- **Example**: `STRIPE_WEBHOOK_SECRET=whsec_xxx`
- **Used by**: `src/infrastructure/payment/providers/StripeProvider.ts:541`

### STRIPE_BASIC_MONTHLY_PRICE_ID
- **Description**: Stripe Price ID for Basic monthly subscription.
- **Type**: String
- **Required**: Yes (if subscriptions enabled)
- **Example**: `STRIPE_BASIC_MONTHLY_PRICE_ID=price_xxx`
- **Used by**: `src/infrastructure/payment/PaymentService.ts:62`

### STRIPE_BASIC_YEARLY_PRICE_ID
- **Description**: Stripe Price ID for Basic yearly subscription.
- **Type**: String
- **Required**: Yes (if subscriptions enabled)
- **Used by**: `src/infrastructure/payment/PaymentService.ts:63`

### STRIPE_PREMIUM_MONTHLY_PRICE_ID
- **Description**: Stripe Price ID for Premium monthly subscription.
- **Type**: String
- **Required**: Yes (if subscriptions enabled)
- **Used by**: `src/infrastructure/payment/PaymentService.ts:73`

### STRIPE_PREMIUM_YEARLY_PRICE_ID
- **Description**: Stripe Price ID for Premium yearly subscription.
- **Type**: String
- **Required**: Yes (if subscriptions enabled)
- **Used by**: `src/infrastructure/payment/PaymentService.ts:74`

### STRIPE_ENTERPRISE_MONTHLY_PRICE_ID
- **Description**: Stripe Price ID for Enterprise monthly subscription.
- **Type**: String
- **Required**: Yes (if subscriptions enabled)
- **Used by**: `src/infrastructure/payment/PaymentService.ts:84`

### STRIPE_ENTERPRISE_YEARLY_PRICE_ID
- **Description**: Stripe Price ID for Enterprise yearly subscription.
- **Type**: String
- **Required**: Yes (if subscriptions enabled)
- **Used by**: `src/infrastructure/payment/PaymentService.ts:85`

---

## WhatsApp

### META_WHATSAPP_TOKEN
- **Description**: Meta WhatsApp Business API access token.
- **Type**: String
- **Required**: Yes (if WhatsApp bot enabled)
- **Example**: `META_WHATSAPP_TOKEN=EAAGxxx`
- **Used by**: `src/presentation/routes/index.ts:357`

### WHATSAPP_PHONE_NUMBER_ID
- **Description**: WhatsApp Business phone number ID.
- **Type**: String
- **Required**: Yes (if WhatsApp bot enabled)
- **Used by**: `src/modules/whatsapp-bot/whatsapp.service.ts:24`

### WHATSAPP_ACCESS_TOKEN
- **Description**: WhatsApp Cloud API access token.
- **Type**: String
- **Required**: Yes (if WhatsApp bot enabled)
- **Used by**: `src/modules/whatsapp-bot/whatsapp.service.ts:25`

### WHATSAPP_VERIFY_TOKEN
- **Description**: Webhook verification token (custom string).
- **Type**: String
- **Required**: Yes (if WhatsApp bot enabled)
- **Default**: `agrobridge_verify_2025`
- **Used by**: `src/modules/whatsapp-bot/whatsapp.service.ts:26`

### WHATSAPP_BUSINESS_ACCOUNT_ID
- **Description**: WhatsApp Business Account ID.
- **Type**: String
- **Required**: No
- **Used by**: `src/modules/whatsapp-bot/whatsapp.service.ts:27`

---

## Monitoring

### SENTRY_DSN
- **Description**: Sentry Data Source Name for error tracking.
- **Type**: URL
- **Required**: Yes (production)
- **Example**: `SENTRY_DSN=https://xxx@o123.ingest.sentry.io/456`

### SERVICE_NAME
- **Description**: Service name for distributed tracing.
- **Type**: String
- **Required**: No
- **Default**: `agrobridge-api`
- **Example**: `SERVICE_NAME=agrobridge-api-prod`

### LOG_LEVEL
- **Description**: Logging verbosity level.
- **Type**: Enum
- **Required**: No
- **Default**: `info`
- **Values**: `error`, `warn`, `info`, `debug`, `trace`
- **Example**: `LOG_LEVEL=debug`
- **Production notes**: Use `info` in production. `debug` exposes sensitive data.

### DEBUG
- **Description**: Enable debug mode (very verbose logging).
- **Type**: Boolean or String
- **Required**: No
- **Default**: `false`
- **Example**: `DEBUG=true` or `DEBUG=*`
- **Used by**: `src/infrastructure/security/vulnerability-scanner.ts:309`
- **Warning**: Never enable in production.

### DD_TRACE_ENABLED
- **Description**: Enable Datadog APM tracing.
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Example**: `DD_TRACE_ENABLED=true`

### DD_AGENT_HOST
- **Description**: Datadog agent hostname.
- **Type**: String
- **Required**: No
- **Default**: `localhost`
- **Example**: `DD_AGENT_HOST=datadog-agent.internal`

### DATADOG_API_KEY
- **Description**: Datadog API key for metrics.
- **Type**: String
- **Required**: No

### NEW_RELIC_LICENSE_KEY
- **Description**: New Relic license key for APM.
- **Type**: String
- **Required**: No

### APM_SAMPLE_RATE
- **Description**: APM transaction sampling rate (0.0 to 1.0).
- **Type**: Number
- **Required**: No
- **Default**: `0.1`
- **Example**: `APM_SAMPLE_RATE=0.5`

### SLOW_REQUEST_THRESHOLD
- **Description**: Threshold in ms for slow request logging.
- **Type**: Number
- **Required**: No
- **Default**: `1000`
- **Example**: `SLOW_REQUEST_THRESHOLD=500`

### CRITICAL_REQUEST_THRESHOLD
- **Description**: Threshold in ms for critical request alerts.
- **Type**: Number
- **Required**: No
- **Default**: `5000`
- **Example**: `CRITICAL_REQUEST_THRESHOLD=3000`

---

## Feature Flags

### COLLECTIONS_ENABLED
- **Description**: Enable automated payment collections cron job.
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Used by**: `src/presentation/routes/index.ts:362`

### COLLECTIONS_CRON_SCHEDULE
- **Description**: Cron schedule for collections job.
- **Type**: String (cron expression)
- **Required**: No
- **Default**: `0 8 * * *` (8 AM daily)
- **Example**: `COLLECTIONS_CRON_SCHEDULE=0 9 * * 1-5`

---

## Fintech

### FACTURAMA_API_URL
- **Description**: Facturama API base URL (Mexican invoicing).
- **Type**: URL
- **Required**: Yes (if invoicing enabled)
- **Default**: `https://apisandbox.facturama.mx`
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:29`

### FACTURAMA_USER
- **Description**: Facturama API username.
- **Type**: String
- **Required**: Yes (if invoicing enabled)
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:30`

### FACTURAMA_PASSWORD
- **Description**: Facturama API password.
- **Type**: String
- **Required**: Yes (if invoicing enabled)
- **Used by**: `src/modules/invoicing/services/invoice.service.ts:31`

---

## External APIs

### GOOGLE_CLIENT_ID
- **Description**: Google OAuth client ID.
- **Type**: String
- **Required**: Yes (if Google login enabled)
- **Used by**: `src/infrastructure/auth/oauth/GoogleOAuthProvider.ts:100`

### GOOGLE_CLIENT_SECRET
- **Description**: Google OAuth client secret.
- **Type**: String
- **Required**: Yes (if Google login enabled)
- **Used by**: `src/infrastructure/auth/oauth/GoogleOAuthProvider.ts:101`

### GOOGLE_CALLBACK_URL
- **Description**: Google OAuth callback URL.
- **Type**: URL
- **Required**: Yes (if Google login enabled)
- **Example**: `GOOGLE_CALLBACK_URL=https://api.agrobridge.io/api/v1/auth/oauth/google/callback`
- **Used by**: `src/infrastructure/auth/oauth/GoogleOAuthProvider.ts:102`

### GITHUB_CLIENT_ID
- **Description**: GitHub OAuth client ID.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/auth/oauth/GitHubOAuthProvider.ts:108`

### GITHUB_CLIENT_SECRET
- **Description**: GitHub OAuth client secret.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/auth/oauth/GitHubOAuthProvider.ts:109`

### GITHUB_CALLBACK_URL
- **Description**: GitHub OAuth callback URL.
- **Type**: URL
- **Required**: No
- **Used by**: `src/infrastructure/auth/oauth/GitHubOAuthProvider.ts:110`

### SENTINEL_HUB_CLIENT_ID
- **Description**: Sentinel Hub API client ID for satellite imagery.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/services/SentinelHubService.ts:522`

### SENTINEL_HUB_CLIENT_SECRET
- **Description**: Sentinel Hub API client secret.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/services/SentinelHubService.ts:523`

### SENTINEL_HUB_INSTANCE_ID
- **Description**: Sentinel Hub instance ID.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/services/SentinelHubService.ts:524`

---

## Queue Configuration

### QUEUE_MAX_RETRIES
- **Description**: Maximum retry attempts for failed queue jobs.
- **Type**: Number
- **Required**: No
- **Default**: `3`
- **Used by**: `src/infrastructure/queue/QueueService.ts:261`

### QUEUE_RETRY_DELAY
- **Description**: Delay between job retries in milliseconds.
- **Type**: Number
- **Required**: No
- **Default**: `2000`
- **Used by**: `src/infrastructure/queue/QueueService.ts:264`

### EMAIL_RATE_LIMIT
- **Description**: Maximum emails per minute per queue.
- **Type**: Number
- **Required**: No
- **Default**: `100`
- **Used by**: `src/infrastructure/queue/QueueService.ts:303`

---

## Virus Scanning

### VIRUS_SCAN_ENABLED
- **Description**: Enable ClamAV virus scanning for uploads.
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Example**: `VIRUS_SCAN_ENABLED=true`

### CLAMD_HOST
- **Description**: ClamAV daemon hostname.
- **Type**: String
- **Required**: No
- **Default**: `localhost`
- **Example**: `CLAMD_HOST=clamav.internal`

### CLAMD_PORT
- **Description**: ClamAV daemon port.
- **Type**: Number
- **Required**: No
- **Default**: `3310`

### CLAMD_TIMEOUT
- **Description**: ClamAV scan timeout in milliseconds.
- **Type**: Number
- **Required**: No
- **Default**: `30000`

---

## IPFS / Pinata

### PINATA_API_KEY
- **Description**: Pinata API key for IPFS pinning.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/ipfs/IPFSService.ts:186`

### PINATA_SECRET_KEY
- **Description**: Pinata API secret.
- **Type**: String
- **Required**: No
- **Used by**: `src/infrastructure/ipfs/IPFSService.ts:187`

### IPFS_GATEWAY
- **Description**: IPFS gateway to use for content retrieval.
- **Type**: Enum
- **Required**: No
- **Default**: `pinata`
- **Values**: `pinata`, `cloudflare`, `ipfs.io`
- **Used by**: `src/infrastructure/ipfs/IPFSService.ts:188`

### INFURA_IPFS_PROJECT_ID
- **Description**: Infura IPFS project ID (alternative to Pinata).
- **Type**: String
- **Required**: No

### INFURA_IPFS_SECRET
- **Description**: Infura IPFS project secret.
- **Type**: String
- **Required**: No

### NFT_STORAGE_API_KEY
- **Description**: NFT.Storage API key for free IPFS pinning.
- **Type**: String
- **Required**: No

---

## Admin Dashboard

### ADMIN_DASHBOARD_USERNAME
- **Description**: Basic auth username for admin dashboard.
- **Type**: String
- **Required**: Yes (if admin dashboard enabled)
- **Example**: `ADMIN_DASHBOARD_USERNAME=admin`

### ADMIN_DASHBOARD_PASSWORD
- **Description**: Basic auth password for admin dashboard.
- **Type**: String
- **Required**: Yes (if admin dashboard enabled)
- **Security**: Use strong password. Minimum 16 characters.

### ADMIN_ENFORCE_IP_ALLOWLIST
- **Description**: Enforce IP allowlist for admin routes.
- **Type**: Boolean
- **Required**: No
- **Default**: `false`
- **Example**: `ADMIN_ENFORCE_IP_ALLOWLIST=true`

### ADMIN_IP_ALLOWLIST
- **Description**: Comma-separated list of allowed admin IPs.
- **Type**: String
- **Required**: No
- **Example**: `ADMIN_IP_ALLOWLIST=10.0.0.1,10.0.0.2`

---

## Public URLs

### PUBLIC_WEB_URL
- **Description**: Public website URL for QR codes and verification links.
- **Type**: URL
- **Required**: No
- **Default**: `https://agrobridge.io`
- **Used by**: `src/domain/entities/PublicTraceability.ts:356`

### VERIFICATION_BASE_URL
- **Description**: Base URL for certificate verification pages.
- **Type**: URL
- **Required**: No
- **Default**: `https://verify.agrobridge.io`
- **Used by**: `src/presentation/routes/organic-certificates.routes.ts:76`

### VERIFY_BASE_URL
- **Description**: Alias for VERIFICATION_BASE_URL.
- **Type**: URL
- **Required**: No
- **Used by**: `src/modules/whatsapp-bot/services/blockchain-notification.service.ts:36`

### APP_DEEPLINK_URL
- **Description**: Mobile app deep link URL scheme.
- **Type**: URL
- **Required**: No
- **Default**: `agrobridge://app`
- **Used by**: `src/modules/whatsapp-bot/services/blockchain-notification.service.ts:37`

---

## Validation

Validate your environment configuration:

```bash
# Check all required vars are set
./scripts/validate-env.sh

# Or manually check critical vars:
for var in DATABASE_URL REDIS_HOST JWT_PRIVATE_KEY_PATH; do
  if [ -z "${!var}" ]; then
    echo "MISSING: $var"
  else
    echo "OK: $var"
  fi
done
```

---

## Security Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Use AWS Secrets Manager** in production
3. **Rotate keys** - JWT keys annually, API keys quarterly
4. **Audit access** - Log who accesses secrets
5. **Encrypt at rest** - Use ENCRYPTION_KEY for sensitive data
6. **Minimum permissions** - AWS IAM policies should be restrictive

---

**Last updated**: December 25, 2025
**Variables documented**: 128/128 (100%)
