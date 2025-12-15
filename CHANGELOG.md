# AgroBridge Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2024-12-14

### Added

#### Documentation (Phase 7)
- **Swagger/OpenAPI:** Interactive REST API documentation at `/api-docs`
- **OpenAPI Spec:** Downloadable specification in JSON (`/openapi.json`) and YAML (`/openapi.yaml`) formats
- **API Landing Page:** Developer portal at `/docs/api` with links to all documentation resources
- **Postman Collection:** Complete API collection with 50+ requests and environment variables
- **Developer Guides:**
  - Getting Started Guide - Quick start for new developers
  - Deployment Guide - Production deployment instructions
  - API Reference - Complete endpoint documentation

#### Core Features
- **REST API v2** with field selection, filtering, and sorting
- **GraphQL API** with complete schema and DataLoader optimization
- **WebSocket** real-time updates via Socket.IO
- **Multi-channel Notifications** (Push, SMS, Email, In-App)
- **Payment Integration** with Stripe subscriptions
- **Report Generation** (PDF, CSV, XLSX)
- **Analytics Dashboard** with statistics and insights

#### Infrastructure
- **Docker** multi-stage builds for production
- **Kubernetes** deployment manifests with auto-scaling
- **CI/CD Pipeline** via GitHub Actions
- **Monitoring** with Prometheus and Grafana
- **Load Testing** with k6

#### Authentication
- **Two-Factor Authentication** (TOTP-based)
- **OAuth2 integration** (Google, GitHub)
- **JWT refresh token rotation**

### Changed
- Enhanced error handling across all endpoints
- Improved API documentation with OpenAPI 3.0

### Security
- Implemented rate limiting per endpoint
- Added Helmet.js security headers
- Encrypted sensitive data with AES-256-GCM

## [1.2.1] - 2025-11-25
### Changed
- **Logging:** Removidos todos los logs de debug y console.* tras validación E2E y QA. El sistema solo expone logs por logger único: listo para Fase 2.
- **Refactor:** Cleaned up dummy logs in Use Cases and verified E2E tests run cleanly.

## [1.2.0-rc.1] - 2025-11-25
### Changed
- **BREAKING CHANGE (ARCH):** Migrated the entire backend (`apps/api`) from CommonJS to native ES Modules.
  - All files now use `import`/`export` syntax.
  - `tsconfig.json` updated to `module: NodeNext`.
  - Relative import paths now require the `.js` extension.
- **Refactor:** Corrected Dependency Injection pattern in `app.ts` for all repositories.
- **Refactor:** Aligned Use Case factory with the `AllUseCases` interface definition.
- **Fix:** Implemented missing methods in `PrismaEventRepository` to conform to its interface.
- **Fix:** Resolved all `tsc` compilation errors related to type mismatches and module resolution.

### Added
- **QA:** Integrated programmatic database seeding and JWT key generation into the E2E test suite, resolving all previous authentication and race condition failures.
- **CI:** The `test:e2e` script now ensures a clean, migrated database for every run.
- **Logging:** Added `ESM_MIGRATION_LOG.md` to document the entire migration process.

## [1.1.0] - 2025-11-25
### Added
- **Enterprise Documentation:** Consolidated `docs/` folder with bilingual support (EN/ES).
- **Legal Framework:** Draft `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` with strict disclaimers.
- **Automation:** CI/CD workflows for Docs QA (`docs-qa.yml`) and Bilingual Sync (`bilingual-sync.yml`).
- **Docs-as-Code:** VitePress integration for static documentation site generation.
- **QA Logs:** Detailed remediation and audit logs (`REMEDIATION_LOG.md`, `QA_LOG.md`).

### Changed
- **Refactor:** Moved governance and technical docs from `apps/api/docs` to root `docs/strategy` and `docs/technical`.
- **CI/CD:** Activated `deploy-docs.yml` pipeline post-audit.
- **Dependencies:** Updated `package.json` to include `vitepress`.

### Milestone
- **[2025-11-25 20:30]** Kick-off de Mejora Continua registrado. Ver log: `KICKOFF_SPRINT_LOG.md`.