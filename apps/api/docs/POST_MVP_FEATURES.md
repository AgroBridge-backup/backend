# Post-MVP Features Roadmap

This document outlines features that are planned for implementation after the MVP beta launch.

## Deferred Features

### 1. NFC Seal Scanning

**Status:** Planned for Phase 2 (Post-Beta)

**Description:** Tamper-evident NFC seals that can be attached to product containers for anti-counterfeiting and verification purposes.

**Features:**
- NFC seal provisioning and assignment to batches
- Mobile NFC scanning for verification
- Tamper detection alerts
- Seal lifecycle management

**Rationale for Deferral:**
- Requires hardware partnership (NFC tags)
- Mobile app NFC integration needs additional development
- Not required for core organic certification MVP

**Files Removed:**
- `src/domain/services/NfcSealService.ts`
- `src/presentation/routes/nfc-seals.routes.ts`
- `src/infrastructure/database/prisma/repositories/PrismaNfcSealRepository.ts`

---

### 2. Satellite Imagery Time-Lapse

**Status:** Planned for Phase 3 (Post-Launch)

**Description:** Integration with satellite imagery providers to capture periodic field images for verification of organic farming practices.

**Features:**
- Field boundary definition with GPS coordinates
- Automated satellite image capture (monthly)
- NDVI analysis for crop health monitoring
- Time-lapse generation for field history
- Anomaly detection (unauthorized land use)

**Rationale for Deferral:**
- Requires third-party satellite API integration (Sentinel, Planet Labs)
- High API costs for satellite imagery
- Complex image processing requirements
- Not required for core organic certification MVP

**Files Removed:**
- `src/domain/services/SatelliteImageryService.ts`
- `src/presentation/routes/satellite-imagery.routes.ts`
- `src/infrastructure/database/prisma/repositories/PrismaFieldImageryRepository.ts`

---

### 3. Direct Blockchain Integration

**Status:** Not Implemented (501)

**Routes:**
- `POST /api/v1/blockchain/submit` - Submit data directly to blockchain
- `GET /api/v1/blockchain/transaction/:txId` - Verify blockchain transaction

**Business Value:** Immutable supply chain verification for enterprise exports. Direct smart contract interaction for advanced traceability.

**Timeline:** Series A Roadmap (Q2 2026)

**Current Alternative:** Organic certificates already include blockchain hash anchoring via `hashOnChain` field, providing proof of authenticity without direct blockchain calls.

**Dependencies:**
- Polygon/Ethereum node infrastructure
- Smart contract development and audit
- Gas fee management system

---

### 4. Export Automation

**Status:** Not Implemented (501)

**Routes:**
- `POST /api/v1/exports` - Create automated export documentation
- `GET /api/v1/exports/:exportId` - Get export details

**Business Value:** Automated generation of export documentation for Gabriela persona (Export Company Admin). Reduces manual paperwork for international shipments.

**Timeline:** Q3 2026

**Current Alternative:** Export-grade organic certificates provide the core documentation needed for exports. Manual export workflow supported via organic-certificates endpoints.

**Dependencies:**
- Integration with SENASICA export systems
- PDF generation for customs documents
- Multi-language support (ES/EN)

---

## Implementation Notes

When implementing these features in future phases:

1. **Create feature branches** from `main` branch
2. **Add proper TypeScript types** - no `@ts-ignore` or `as any`
3. **Include comprehensive unit tests** (>80% coverage)
4. **Add e2e tests** for API endpoints
5. **Update API documentation** (OpenAPI/Swagger)
6. **Consider rate limiting** for resource-intensive operations

---

## Contact

For questions about feature prioritization, contact the product team.

Last Updated: December 2024
