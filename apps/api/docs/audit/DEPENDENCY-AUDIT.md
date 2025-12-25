# AgroBridge Backend - Dependency Audit

**Generated:** December 25, 2025

---

## Summary

| Metric | Count |
|--------|-------|
| Production Dependencies | 67 |
| Dev Dependencies | 41 |
| Total Packages | 108 |
| Potentially Unused | 5-8 |
| Security Vulnerabilities | Check below |

---

## Production Dependencies (67)

### Core Framework

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `express` | ^4.18.2 | Web framework | USED |
| `typescript` | ^5.3.3 | Type system | USED |
| `dotenv` | ^16.6.1 | Environment loading | USED |
| `compression` | ^1.7.4 | Response compression | USED |
| `cors` | ^2.8.5 | CORS handling | USED |

### Database & Caching

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@prisma/client` | ^5.9.1 | Database ORM | USED |
| `prisma` | ^5.9.1 | Prisma CLI | USED |
| `ioredis` | ^5.3.2 | Redis client | USED |
| `bull` | ^4.12.0 | Job queues | USED |

### Authentication & Security

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `jsonwebtoken` | ^9.0.2 | JWT handling | USED |
| `bcryptjs` | ^2.4.3 | Password hashing | USED |
| `helmet` | ^7.2.0 | Security headers | USED |
| `hpp` | ^0.2.3 | HTTP param pollution | USED |
| `express-rate-limit` | ^7.5.1 | Rate limiting | USED |
| `rate-limit-redis` | ^4.3.1 | Redis rate limiter | USED |
| `rate-limiter-flexible` | ^4.0.1 | Flexible rate limiter | USED |
| `otplib` | ^12.0.1 | 2FA TOTP | USED |
| `speakeasy` | ^2.0.0 | 2FA backup | USED |
| `sanitize-html` | ^2.17.0 | HTML sanitization | USED |
| `xss-clean` | ^0.1.4 | XSS protection | USED |

### Blockchain

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `ethers` | ^5.7.2 | Ethereum library | USED |
| `elliptic` | ^6.6.1 | Crypto curves | USED |

### AWS SDK

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@aws-sdk/client-s3` | ^3.948.0 | S3 storage | USED |
| `@aws-sdk/client-ses` | ^3.948.0 | Email sending | USED |
| `@aws-sdk/client-secrets-manager` | ^3.958.0 | Secrets | USED |
| `@aws-sdk/s3-request-presigner` | ^3.948.0 | Pre-signed URLs | USED |

### Notifications

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `firebase-admin` | ^12.7.0 | FCM push | USED |
| `@parse/node-apn` | ^7.0.1 | iOS push | USED |
| `@sendgrid/mail` | ^8.1.0 | Email | USED |
| `twilio` | ^5.10.7 | SMS/WhatsApp | USED |

### API & Documentation

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `graphql` | ^16.12.0 | GraphQL | USED |
| `graphql-yoga` | ^5.17.1 | GraphQL server | USED |
| `@graphql-tools/schema` | ^10.0.30 | Schema tools | USED |
| `swagger-jsdoc` | ^6.2.8 | API docs generation | USED |
| `swagger-ui-express` | ^5.0.1 | API docs UI | USED |

### Utilities

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `zod` | ^3.22.4 | Validation | USED |
| `uuid` | ^13.0.0 | UUID generation | USED |
| `date-fns` | ^3.3.1 | Date utilities | USED |
| `axios` | ^1.6.5 | HTTP client | USED |
| `handlebars` | ^4.7.8 | Templating | USED |
| `qrcode` | ^1.5.3 | QR generation | USED |
| `pdfkit` | ^0.17.2 | PDF generation | USED |
| `sharp` | ^0.34.5 | Image processing | USED |
| `exceljs` | ^4.4.0 | Excel exports | USED |
| `csv-stringify` | ^6.6.0 | CSV exports | USED |
| `decimal.js` | ^10.6.0 | Decimal math | USED |

### Monitoring & Logging

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@sentry/node` | ^10.32.1 | Error tracking | USED |
| `@sentry/profiling-node` | ^10.32.1 | Profiling | USED |
| `winston` | ^3.19.0 | Logging | USED |
| `winston-daily-rotate-file` | ^5.0.0 | Log rotation | USED |
| `morgan` | ^1.10.0 | HTTP logging | USED |

### Real-time

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `socket.io` | ^4.8.1 | WebSocket | USED |
| `ws` | ^8.18.3 | WebSocket client | USED |

### Other

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `stripe` | ^20.0.0 | Payments | USED |
| `multer` | ^2.0.2 | File uploads | USED |
| `node-cron` | ^4.2.1 | Cron jobs | USED |
| `@turf/bbox` | ^7.3.1 | Geo bounding box | USED |
| `@turf/helpers` | ^7.3.1 | Geo helpers | USED |
| `validator` | ^13.15.23 | String validation | USED |
| `form-data` | ^4.0.0 | Form data | USED |
| `js-yaml` | ^4.1.1 | YAML parsing | USED |
| `jws` | ^4.0.1 | JSON Web Signatures | USED |
| `dataloader` | ^2.2.3 | GraphQL batching | USED |

### Potentially Unused

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@bull-board/api` | ^5.23.0 | Queue dashboard | CHECK |
| `@bull-board/express` | ^5.23.0 | Queue dashboard | CHECK |
| `@vendia/serverless-express` | ^4.12.6 | AWS Lambda | CHECK |
| `serverless-offline` | ^14.4.0 | Lambda dev | CHECK |
| `winston-datadog` | ^1.1.0 | Datadog logging | CHECK |

---

## Dev Dependencies (41)

### Testing

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `vitest` | ^1.2.1 | Test runner | USED |
| `@vitest/coverage-v8` | ^1.2.1 | Coverage | USED |
| `supertest` | ^6.3.4 | HTTP testing | USED |
| `@faker-js/faker` | ^10.1.0 | Test data | USED |
| `socket.io-client` | ^4.8.1 | WS testing | USED |

### TypeScript Types

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/bcryptjs` | ^2.4.6 | Type definitions |
| `@types/compression` | ^1.7.5 | Type definitions |
| `@types/cors` | ^2.8.17 | Type definitions |
| `@types/express` | ^4.17.21 | Type definitions |
| `@types/hpp` | ^0.2.7 | Type definitions |
| `@types/jsonwebtoken` | ^9.0.5 | Type definitions |
| `@types/morgan` | ^1.9.9 | Type definitions |
| `@types/multer` | ^2.0.0 | Type definitions |
| `@types/node` | ^20.19.25 | Type definitions |
| `@types/pdfkit` | ^0.17.4 | Type definitions |
| `@types/qrcode` | ^1.5.5 | Type definitions |
| `@types/sanitize-html` | ^2.16.0 | Type definitions |
| `@types/speakeasy` | ^2.0.10 | Type definitions |
| `@types/supertest` | ^6.0.2 | Type definitions |
| `@types/swagger-jsdoc` | ^6.0.4 | Type definitions |
| `@types/swagger-ui-express` | ^4.1.8 | Type definitions |
| `@types/uuid` | ^10.0.0 | Type definitions |
| `@types/validator` | ^13.15.10 | Type definitions |

### Build Tools

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `tsx` | ^4.7.0 | TS execution | USED |
| `tsc-alias` | ^1.8.8 | Path aliases | USED |
| `nodemon` | ^3.1.11 | Hot reload | USED |

### Code Quality

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `eslint` | ^8.56.0 | Linting | USED |
| `@typescript-eslint/eslint-plugin` | ^6.19.0 | TS ESLint | USED |
| `@typescript-eslint/parser` | ^6.19.0 | TS parser | USED |
| `prettier` | ^3.2.4 | Formatting | USED |

### Blockchain Dev

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `hardhat` | ^2.22.0 | Smart contracts | CHECK |
| `@nomiclabs/hardhat-ethers` | ^2.2.3 | Hardhat ethers | CHECK |
| `@nomiclabs/hardhat-waffle` | ^2.0.6 | Hardhat testing | CHECK |
| `@openzeppelin/contracts` | ^5.4.0 | Contract libs | CHECK |
| `typechain` | ^8.3.2 | Contract types | CHECK |
| `@typechain/ethers-v6` | ^0.5.1 | Typechain ethers | CHECK |
| `@typechain/hardhat` | ^9.1.0 | Typechain hardhat | CHECK |
| `ipfs-http-client` | ^60.0.1 | IPFS client | CHECK |

---

## Security Audit

Run security audit:
```bash
npm audit
```

### Common Vulnerabilities to Check

1. **Prototype Pollution** - Check lodash, qs versions
2. **ReDoS** - Check validator, sanitize-html
3. **XSS** - Check handlebars version
4. **Command Injection** - Check sharp, pdfkit

---

## Recommendations

### Packages to Verify

```bash
# Check if these are actually imported
grep -r "bull-board" src/ --include="*.ts"
grep -r "serverless" src/ --include="*.ts"
grep -r "winston-datadog" src/ --include="*.ts"
```

### Packages to Potentially Remove

If not used after verification:
```bash
npm uninstall @vendia/serverless-express serverless-offline winston-datadog
```

### Update Outdated

```bash
# Check for updates
npm outdated

# Update all minor/patch versions
npm update

# Update major versions (test carefully)
npm install package@latest
```

---

## Dependency Tree

```bash
# View full dependency tree
npm ls --all

# Find why a package is installed
npm explain package-name
```

---

*Generated by Claude Code Audit - December 25, 2025*
