# AgroBridge Backend Documentation

Quick links to everything you need.

---

## Getting Started

| Doc | Time | Description |
|-----|------|-------------|
| [Onboarding Guide](./ONBOARDING.md) | 20 min | Set up your development environment |
| [Architecture](../ARCHITECTURE.md) | 15 min | Understand the codebase structure |

---

## Reference

| Doc | Description |
|-----|-------------|
| [API Endpoints](./API-ENDPOINTS.md) | Complete reference for all 309 endpoints |
| [API Documentation](../API-DOCUMENTATION.md) | OpenAPI/Swagger specification |
| [Environment Variables](./ENVIRONMENT.md) | All 128 configuration options |
| [Error Codes](./ERROR-CODES.md) | All 54 error codes with solutions |
| [Security](./SECURITY.md) | Authentication, authorization, compliance |

---

## Module Deep-Dives

Comprehensive documentation for core platform modules:

| Module | Description |
|--------|-------------|
| [Organic Certification](./modules/ORGANIC-CERTIFICATION.md) | Certificate generation, blockchain anchoring, PDF generation |
| [Field Inspections](./modules/FIELD-INSPECTIONS.md) | GPS verification, photo evidence, organic input tracking |
| [Export Company Dashboard](./modules/EXPORT-COMPANY-DASHBOARD.md) | B2B admin portal, farmer management, billing |
| [Public Traceability](./modules/PUBLIC-TRACEABILITY.md) | QR code scanning, consumer-facing portal |
| [Payment Processing](./modules/PAYMENT-PROCESSING.md) | Stripe subscriptions, usage tracking, invoices |
| [Notifications](./modules/NOTIFICATIONS.md) | Push, email, SMS, WhatsApp delivery |

---

## Operations

| Doc | Description |
|-----|-------------|
| [Deployment Guide](../DEPLOYMENT.md) | Production deployment (PM2, Docker, AWS) |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and fixes |
| [Production Checklist](../PRODUCTION-CHECKLIST.md) | Pre-deployment verification |

---

## By Task

### "I want to..."

| Task | Go to |
|------|-------|
| Set up my dev environment | [Onboarding Guide](./ONBOARDING.md) |
| Add a new API endpoint | [Architecture - Adding Features](../ARCHITECTURE.md#adding-new-features) |
| Understand the code structure | [Architecture Guide](../ARCHITECTURE.md) |
| Deploy to production | [Deployment Guide](../DEPLOYMENT.md) |
| Fix something that's broken | [Troubleshooting](./TROUBLESHOOTING.md) |
| Check API endpoints | [API Documentation](../API-DOCUMENTATION.md) |
| Configure environment variables | [Environment](./ENVIRONMENT.md) |

---

## Audit Reports

Technical analysis of the codebase:

| Report | Description |
|--------|-------------|
| [Executive Summary](./audit/EXECUTIVE-SUMMARY.md) | High-level findings |
| [File Inventory](./audit/FILE-INVENTORY.md) | Complete file listing |
| [Architecture Review](./audit/ARCHITECTURE-REVIEW.md) | Code quality analysis |
| [Documentation Assessment](./audit/DOCUMENTATION-ASSESSMENT.md) | Doc quality review |
| [Documentation Critical Review](./audit/DOCUMENTATION-CRITICAL-REVIEW.md) | **47 issues, severity-rated** |
| [Dependency Audit](./audit/DEPENDENCY-AUDIT.md) | Package analysis |

---

## Quick Commands

```bash
npm run dev           # Start development server
npm test              # Run tests
npm run build         # Build for production
npm run prisma:studio # Visual database browser
```

---

## Getting Help

- **Slack:** #backend-support
- **Issues:** [GitHub Issues](https://github.com/AgroBridge-backup/backend/issues)
