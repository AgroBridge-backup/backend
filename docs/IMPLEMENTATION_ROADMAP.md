# IMPLEMENTATION ROADMAP: ORGANIC CERTIFICATION MVP

**Date**: 2025-12-24
**Target Duration**: 4 Weeks
**Team Size Assumption**: 1-2 Backend Developers

---

## EXECUTIVE SUMMARY

This roadmap outlines a 4-week sprint to build the organic certification MVP. The plan leverages 70-80% of existing AgroBridge infrastructure and focuses on the critical path: Export Company onboarding, Farmer enrollment, Field inspections, and Certificate generation with blockchain anchoring.

---

## WEEK 1: FOUNDATION (Export Company Portal)

### Day 1-2: Database Schema & Migrations

**Tasks**:
- [ ] Create ExportCompany Prisma model
- [ ] Create FarmerInvitation Prisma model
- [ ] Create OrganicField Prisma model
- [ ] Create FieldInspection Prisma model
- [ ] Create InspectionPhoto Prisma model
- [ ] Create OrganicInput Prisma model
- [ ] Create FieldActivity Prisma model
- [ ] Create OrganicCertificate Prisma model
- [ ] Extend Producer model with `exportCompanyId`
- [ ] Extend User model with `exportCompanyAdminId`
- [ ] Run `prisma migrate dev --name organic_cert_models`
- [ ] Write seed data for testing

**Files to Create/Modify**:
```
apps/api/src/infrastructure/database/prisma/schema.prisma
apps/api/src/infrastructure/database/seed-organic.ts
```

**Acceptance Criteria**:
- All migrations run successfully
- Seed data populates test export company + farmers
- No breaking changes to existing functionality

### Day 3-4: Export Company Registration & Auth

**Tasks**:
- [ ] Create `ExportCompanyRepository` interface
- [ ] Create `PrismaExportCompanyRepository` implementation
- [ ] Create `RegisterExportCompanyUseCase`
- [ ] Create export company registration endpoint
- [ ] Add `EXPORT_COMPANY_ADMIN` to UserRole enum
- [ ] Create `ExportCompanyService` domain service
- [ ] Add export company JWT claims
- [ ] Create `requireExportCompanyAdmin` middleware

**Endpoints**:
```
POST /api/v1/export-companies/register
GET  /api/v1/export-companies/me
PUT  /api/v1/export-companies/me
```

**Files to Create**:
```
apps/api/src/domain/repositories/IExportCompanyRepository.ts
apps/api/src/infrastructure/database/prisma/repositories/PrismaExportCompanyRepository.ts
apps/api/src/application/use-cases/export-company/RegisterExportCompanyUseCase.ts
apps/api/src/application/use-cases/export-company/GetExportCompanyUseCase.ts
apps/api/src/domain/services/ExportCompanyService.ts
apps/api/src/presentation/routes/export-company.routes.ts
apps/api/src/presentation/middlewares/exportCompanyAuth.middleware.ts
```

**Acceptance Criteria**:
- Export company can register with RFC, email, tier
- Admin user created automatically
- JWT token includes exportCompanyId claim
- `/me` endpoint returns company profile

### Day 5-7: Farmer Invitation System

**Tasks**:
- [ ] Create `FarmerInvitationRepository` interface
- [ ] Create `PrismaFarmerInvitationRepository` implementation
- [ ] Create `InviteFarmersUseCase` (bulk invite)
- [ ] Create `AcceptInvitationUseCase` (farmer enrollment)
- [ ] Create email template for farmer invitation
- [ ] Create invitation endpoints
- [ ] Add invitation token validation
- [ ] Link farmer to export company on enrollment

**Endpoints**:
```
POST /api/v1/export-companies/me/farmers/invite
GET  /api/v1/export-companies/me/farmers
POST /api/v1/farmers/enroll
```

**Email Template**:
```
Subject: {{companyName}} te invita a AgroBridge Organic
Body: {{companyName}} te invita a certificar tu producción orgánica...
CTA: [Registrarme] -> /enroll?token={{inviteToken}}
```

**Files to Create**:
```
apps/api/src/domain/repositories/IFarmerInvitationRepository.ts
apps/api/src/infrastructure/database/prisma/repositories/PrismaFarmerInvitationRepository.ts
apps/api/src/application/use-cases/export-company/InviteFarmersUseCase.ts
apps/api/src/application/use-cases/farmers/EnrollFarmerUseCase.ts
apps/api/src/infrastructure/notifications/templates/farmer-invitation.html
```

**Acceptance Criteria**:
- Export company can invite farmers via email list
- Farmers receive email with unique invitation link
- Farmers can register without payment
- Farmer automatically linked to export company

---

## WEEK 2: FIELD INSPECTION & DATA COLLECTION

### Day 8-9: Organic Field Management

**Tasks**:
- [ ] Create `OrganicFieldRepository` interface
- [ ] Create `PrismaOrganicFieldRepository` implementation
- [ ] Create `CreateOrganicFieldUseCase`
- [ ] Create `UpdateOrganicFieldUseCase`
- [ ] Create `ListFarmerFieldsUseCase`
- [ ] Create field CRUD endpoints
- [ ] Add GeoJSON boundary validation
- [ ] Integrate with existing Field entity (optional)

**Endpoints**:
```
GET  /api/v1/farmers/me/organic-fields
POST /api/v1/farmers/me/organic-fields
PUT  /api/v1/farmers/me/organic-fields/:id
GET  /api/v1/farmers/me/organic-fields/:id
```

**Files to Create**:
```
apps/api/src/domain/repositories/IOrganicFieldRepository.ts
apps/api/src/infrastructure/database/prisma/repositories/PrismaOrganicFieldRepository.ts
apps/api/src/application/use-cases/organic-fields/CreateOrganicFieldUseCase.ts
apps/api/src/application/use-cases/organic-fields/UpdateOrganicFieldUseCase.ts
apps/api/src/application/use-cases/organic-fields/ListFarmerFieldsUseCase.ts
apps/api/src/domain/entities/OrganicField.ts
apps/api/src/presentation/routes/organic-fields.routes.ts
```

**Acceptance Criteria**:
- Farmer can create field with GPS boundary (GeoJSON polygon)
- Farmer can update field information
- Fields associated with farmer and export company

### Day 10-12: Field Inspection API

**Tasks**:
- [ ] Create `FieldInspectionRepository` interface
- [ ] Create `PrismaFieldInspectionRepository` implementation
- [ ] Create `CreateInspectionUseCase`
- [ ] Create `UploadInspectionPhotoUseCase`
- [ ] Create `AddOrganicInputUseCase`
- [ ] Create `AddFieldActivityUseCase`
- [ ] Create `FieldInspectionService` domain service
- [ ] Implement GPS verification (point-in-polygon)
- [ ] Create inspection endpoints

**Endpoints**:
```
POST /api/v1/farmers/me/organic-fields/:fieldId/inspections
GET  /api/v1/farmers/me/organic-fields/:fieldId/inspections
POST /api/v1/inspections/:id/photos
POST /api/v1/inspections/:id/inputs
POST /api/v1/inspections/:id/activities
```

**GPS Verification Logic**:
```typescript
// Use Turf.js for point-in-polygon
import * as turf from '@turf/turf';

function isPointWithinField(
  lat: number,
  lng: number,
  fieldBoundaryGeoJson: GeoJSON.Polygon
): { within: boolean; distance?: number } {
  const point = turf.point([lng, lat]);
  const polygon = turf.polygon(fieldBoundaryGeoJson.coordinates);

  if (turf.booleanPointInPolygon(point, polygon)) {
    return { within: true };
  }

  // Calculate distance if outside
  const boundary = turf.polygonToLine(polygon);
  const distance = turf.pointToLineDistance(point, boundary, { units: 'meters' });

  return { within: false, distance };
}
```

**Files to Create**:
```
apps/api/src/domain/repositories/IFieldInspectionRepository.ts
apps/api/src/infrastructure/database/prisma/repositories/PrismaFieldInspectionRepository.ts
apps/api/src/application/use-cases/inspections/CreateInspectionUseCase.ts
apps/api/src/application/use-cases/inspections/UploadPhotoUseCase.ts
apps/api/src/application/use-cases/inspections/AddOrganicInputUseCase.ts
apps/api/src/application/use-cases/inspections/AddActivityUseCase.ts
apps/api/src/domain/services/FieldInspectionService.ts
apps/api/src/domain/services/GeoVerificationService.ts
apps/api/src/presentation/routes/inspections.routes.ts
```

**Acceptance Criteria**:
- Farmer can create inspection with timestamp + GPS
- Photos uploaded with GPS metadata extraction
- GPS verified against field boundary
- Organic inputs and activities logged

### Day 13-14: Receipt OCR Integration

**Tasks**:
- [ ] Integrate Google Cloud Vision API
- [ ] Create `OCRService` for receipt processing
- [ ] Create `ScanReceiptUseCase`
- [ ] Extract product name, date, quantity, supplier
- [ ] Add organic product keyword detection
- [ ] Create receipt scan endpoint

**Endpoint**:
```
POST /api/v1/inspections/:id/inputs/scan-receipt
Request: multipart/form-data { receipt: File }
Response: {
  extractedData: { productName, brandName, date, quantity, supplier, isOrganic, confidence }
  receiptUrl: string
}
```

**OCR Service Implementation**:
```typescript
// Location: apps/api/src/infrastructure/external/GoogleVisionOCRService.ts

import vision from '@google-cloud/vision';

export class GoogleVisionOCRService implements IOCRService {
  private client: vision.ImageAnnotatorClient;

  constructor() {
    this.client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
    });
  }

  async processReceipt(imageUrl: string): Promise<OCRResult> {
    const [result] = await this.client.textDetection(imageUrl);
    const text = result.textAnnotations?.[0]?.description || '';

    return this.parseReceiptText(text);
  }

  private parseReceiptText(text: string): OCRResult {
    // Extract product names, dates, quantities using regex patterns
    // Detect organic keywords: "orgánico", "OMRI", "natural", etc.
  }
}
```

**Files to Create**:
```
apps/api/src/domain/services/IOCRService.ts
apps/api/src/infrastructure/external/GoogleVisionOCRService.ts
apps/api/src/application/use-cases/inspections/ScanReceiptUseCase.ts
```

**Acceptance Criteria**:
- Receipt images processed via Google Cloud Vision
- Key data extracted with confidence scores
- Organic products flagged automatically

---

## WEEK 3: CERTIFICATE GENERATION

### Day 15-16: OrganicCertificateService

**Tasks**:
- [ ] Create `OrganicCertificateRepository` interface
- [ ] Create `PrismaOrganicCertificateRepository` implementation
- [ ] Create `RequestCertificateUseCase`
- [ ] Create `OrganicCertificateService` domain service
- [ ] Implement certificate eligibility checking
- [ ] Implement certificate number generation
- [ ] Create certificate request endpoint

**Certificate Eligibility Rules**:
```typescript
const MINIMUM_INSPECTIONS = 4; // In last 90 days
const MINIMUM_ORGANIC_INPUTS = 1; // At least 1 verified input
const MINIMUM_PHOTOS = 5; // Per field

async canRequestCertificate(
  farmerId: string,
  fieldIds: string[],
  standard: CertificationType
): Promise<EligibilityResult> {
  // Check each field has minimum inspections
  // Check organic inputs are verified
  // Check fields are certified for requested standard
  // Return eligibility with missing requirements
}
```

**Endpoint**:
```
POST /api/v1/farmers/me/certificates/request
GET  /api/v1/farmers/me/certificates
GET  /api/v1/farmers/me/certificates/:id/eligibility
```

**Files to Create**:
```
apps/api/src/domain/repositories/IOrganicCertificateRepository.ts
apps/api/src/infrastructure/database/prisma/repositories/PrismaOrganicCertificateRepository.ts
apps/api/src/application/use-cases/organic-certificates/RequestCertificateUseCase.ts
apps/api/src/application/use-cases/organic-certificates/CheckEligibilityUseCase.ts
apps/api/src/domain/services/OrganicCertificateService.ts
apps/api/src/domain/entities/OrganicCertificate.ts
```

### Day 17-18: PDF Generation

**Tasks**:
- [ ] Design certificate PDF template
- [ ] Create `CertificatePDFService` using PDFKit
- [ ] Generate QR code for certificate verification
- [ ] Include field inspection summary
- [ ] Include organic input list
- [ ] Upload PDF to S3

**PDF Template Sections**:
```
┌─────────────────────────────────────────────────────────────┐
│ [AgroBridge Logo]                    [USDA Organic Logo]   │
├─────────────────────────────────────────────────────────────┤
│                ORGANIC CERTIFICATE                          │
│                                                             │
│  Certificate Number: AGB-MX-2025-001234                     │
│  [QR CODE]                                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  PRODUCER INFORMATION                                       │
│  Name: Miguel García                                        │
│  Location: Tancítaro, Michoacán, Mexico                     │
│  Total Hectares: 50 ha                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  CERTIFICATION DETAILS                                      │
│  Standard: USDA Organic                                     │
│  Crop: Hass Avocado                                         │
│  Harvest Date: February 15, 2025                            │
│  Valid From: January 15, 2025                               │
│  Valid Until: January 15, 2026                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  VERIFICATION SUMMARY                                       │
│  Field Inspections: 12 (last 90 days)                       │
│  Photos Captured: 156                                       │
│  Organic Inputs Verified: 8                                 │
│  GPS Verification: 100% within declared boundaries          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BLOCKCHAIN VERIFICATION                                    │
│  Network: Polygon                                           │
│  TX Hash: 0x123abc...                                       │
│  Timestamp: 2025-01-15 10:45:23 UTC                         │
│  IPFS: QmX7Y8Z...                                           │
│                                                             │
│  Verify at: https://verify.agrobridge.io/AGB-MX-2025-001234│
├─────────────────────────────────────────────────────────────┤
│  [Verified by AgroBridge] [ISO 9001 Badge] [Polygon Logo]   │
└─────────────────────────────────────────────────────────────┘
```

**Files to Create**:
```
apps/api/src/domain/services/CertificatePDFService.ts
apps/api/src/infrastructure/pdf/OrganicCertificatePDFGenerator.ts
apps/api/src/infrastructure/qr/QRCodeService.ts
```

### Day 19-20: Blockchain Anchoring

**Tasks**:
- [ ] Deploy OrganicCertificateRegistry smart contract to Mumbai
- [ ] Create `OrganicCertificateBlockchainService`
- [ ] Integrate with existing BlockchainService
- [ ] Anchor certificate hash on-chain
- [ ] Store TX hash in database

**Smart Contract Deployment**:
```bash
# Using Hardhat
cd apps/api/blockchain
npx hardhat compile
npx hardhat deploy --network mumbai
# Save deployed address to .env
```

**Files to Create/Modify**:
```
apps/api/blockchain/contracts/OrganicCertificateRegistry.sol
apps/api/blockchain/scripts/deploy-organic-registry.ts
apps/api/src/infrastructure/blockchain/OrganicCertificateBlockchainService.ts
```

### Day 21: IPFS Upload

**Tasks**:
- [ ] Create certificate metadata JSON schema
- [ ] Upload to IPFS via Pinata
- [ ] Store IPFS CID in database
- [ ] Add IPFS URL to PDF

**Metadata Schema**:
```json
{
  "certificateNumber": "AGB-MX-2025-001234",
  "version": "1.0.0",
  "farmer": {
    "name": "Miguel García",
    "producerId": "xxx"
  },
  "fields": [
    {
      "fieldId": "xxx",
      "name": "Parcela Norte",
      "hectares": 25,
      "crop": "Hass Avocado"
    }
  ],
  "inspections": [
    {
      "date": "2025-01-10",
      "photosCount": 12,
      "inputsVerified": 3
    }
  ],
  "certification": {
    "standard": "USDA_ORGANIC",
    "validFrom": "2025-01-15",
    "validTo": "2026-01-15"
  },
  "blockchain": {
    "network": "polygon",
    "txHash": "0x123abc...",
    "contentHash": "sha256:abc123..."
  },
  "generatedAt": "2025-01-15T10:45:23Z"
}
```

**Files to Modify**:
```
apps/api/src/infrastructure/ipfs/PinataIPFSService.ts (extend)
apps/api/src/domain/services/OrganicCertificateService.ts (add IPFS upload)
```

---

## WEEK 4: DASHBOARD & VERIFICATION

### Day 22-23: Export Company Dashboard API

**Tasks**:
- [ ] Create `GetDashboardStatsUseCase`
- [ ] Create `ListPendingCertificatesUseCase`
- [ ] Create dashboard stats endpoint
- [ ] Create pending certificates endpoint
- [ ] Add farmer list with stats

**Endpoints**:
```
GET  /api/v1/export-companies/me/dashboard
GET  /api/v1/export-companies/me/certificates/pending
GET  /api/v1/export-companies/me/farmers/:farmerId
```

**Dashboard Stats Response**:
```json
{
  "farmers": { "total": 127, "active": 98, "inactive": 29 },
  "certificates": { "total": 456, "pending": 23, "approved": 401, "thisMonth": 67 },
  "fields": { "total": 312, "hectares": 8450 },
  "inspections": { "thisMonth": 342, "avgPerFarmer": 3.5 },
  "billing": { "currentMonthFee": 1500, "certificateFees": 670, "totalDue": 2170 }
}
```

**Files to Create**:
```
apps/api/src/application/use-cases/export-company/GetDashboardStatsUseCase.ts
apps/api/src/application/use-cases/export-company/ListPendingCertificatesUseCase.ts
apps/api/src/application/use-cases/export-company/GetFarmerDetailsUseCase.ts
```

### Day 24-25: Certificate Review Flow

**Tasks**:
- [ ] Create `ApproveCertificateUseCase`
- [ ] Create `RejectCertificateUseCase`
- [ ] Trigger blockchain anchoring on approval
- [ ] Generate final PDF on approval
- [ ] Send notification to farmer

**Endpoints**:
```
POST /api/v1/export-companies/me/certificates/:id/approve
POST /api/v1/export-companies/me/certificates/:id/reject
```

**Files to Create**:
```
apps/api/src/application/use-cases/organic-certificates/ApproveCertificateUseCase.ts
apps/api/src/application/use-cases/organic-certificates/RejectCertificateUseCase.ts
```

### Day 26-27: Public Verification API

**Tasks**:
- [ ] Create `VerifyOrganicCertificateUseCase`
- [ ] Create public verification endpoint
- [ ] Create verification page HTML template
- [ ] Log verification events (privacy-safe)
- [ ] Add verification count to response

**Endpoints**:
```
GET /api/v1/verify/organic/:certificateNumber
POST /api/v1/verify/organic/:certificateNumber/log
```

**Verification Page (SSR or SPA)**:
```
URL: https://verify.agrobridge.io/AGB-MX-2025-001234

Page Content:
- Certificate status (VALID ✓ / INVALID ✗ / REVOKED)
- Farmer name (first name + initial)
- Location (State, Mexico)
- Crop type and variety
- Certification standard with logo
- Validity dates
- Blockchain proof (TX hash link to explorer)
- Sample photos (3-5)
- "Verified X times" counter
- Download PDF button
```

**Files to Create**:
```
apps/api/src/application/use-cases/public/VerifyOrganicCertificateUseCase.ts
apps/api/src/presentation/routes/public-organic-verify.routes.ts
apps/public-web/pages/verify/[certificateNumber].tsx (if using Next.js)
```

### Day 28: Testing, Bug Fixes, Deployment Prep

**Tasks**:
- [ ] Write unit tests for critical use cases
- [ ] Write integration tests for API endpoints
- [ ] Fix any bugs discovered
- [ ] Update API documentation
- [ ] Prepare staging deployment
- [ ] Create deployment checklist

**Test Files to Create**:
```
apps/api/tests/unit/organic-certificates/RequestCertificateUseCase.test.ts
apps/api/tests/unit/organic-certificates/ApproveCertificateUseCase.test.ts
apps/api/tests/integration/organic-certification-flow.test.ts
apps/api/tests/e2e/organic-certificate.e2e.test.ts
```

---

## TECHNICAL DECISIONS

### 1. Blockchain Network

**Recommendation**: Polygon (Matic) Mainnet

| Factor | Polygon | Base | Ethereum |
|--------|---------|------|----------|
| Gas Cost | ~$0.01/tx | ~$0.02/tx | $5-50/tx |
| Speed | 2-3 sec | 2 sec | 12-15 sec |
| Ecosystem | Mature | Growing | Most mature |
| Tooling | Excellent | Good | Excellent |

**Decision**: Start with Polygon Mumbai (testnet), migrate to Polygon Mainnet for production.

### 2. PDF Generation

**Recommendation**: PDFKit (Node.js native)

| Option | Pros | Cons |
|--------|------|------|
| PDFKit | Native, fast, no dependencies | Manual layout |
| Puppeteer | HTML to PDF, easy styling | Chrome dependency, slow |
| LaTeX | Professional output | Complex setup |

**Decision**: PDFKit for performance and simplicity.

### 3. IPFS Provider

**Recommendation**: Pinata (Managed)

| Option | Cost | Reliability | Notes |
|--------|------|-------------|-------|
| Pinata | Free 1GB, $20/mo for 20GB | High | Managed, good API |
| NFT.Storage | Free (for NFTs) | High | Filecoin-backed |
| Self-hosted | Infrastructure cost | Variable | Maintenance burden |

**Decision**: Pinata free tier for MVP, upgrade as volume grows.

### 4. OCR Service

**Recommendation**: Google Cloud Vision API

| Option | Cost | Accuracy | Notes |
|--------|------|----------|-------|
| Google Vision | $1.50/1000 images | High | Best accuracy |
| AWS Textract | $1.50/1000 pages | High | AWS ecosystem |
| Tesseract.js | Free | Medium | Open source, less accurate |

**Decision**: Google Cloud Vision for production accuracy.

### 5. QR Code Generation

**Recommendation**: Server-side with `qrcode` npm package

**Decision**: Generate QR on certificate creation, store in S3.

### 6. File Storage

**Recommendation**: AWS S3 (existing)

**Decision**: Continue using existing S3 setup for PDFs, photos, receipts.

### 7. Export Company Billing

**Recommendation**: Stripe (existing)

**Decision**: Use existing Stripe integration with new subscription products.

---

## DE-PRIORITIZATION PLAN

### Features to Disable (Not Delete)

| Feature | Location | Action |
|---------|----------|--------|
| Cash Flow Bridge | `/api/v1/advances/*` | Comment out route registration |
| Credit Scoring | `/api/v1/credit/*` | Comment out route registration |
| Liquidity Pools | `/api/v1/liquidity-pools/*` | Comment out route registration |
| Collections | `/api/v1/collections/*` | Comment out route registration |
| Repayments | `/api/v1/repayments/*` | Comment out route registration |
| WhatsApp Bot | `/api/v1/webhook/whatsapp` | Disable via feature flag |
| Referrals | `/api/v1/referrals/*` | Keep for later integration |

### Environment Variable to Add

```env
# Feature Flags
FEATURE_CASH_FLOW_BRIDGE=false
FEATURE_WHATSAPP_BOT=false
FEATURE_REFERRALS=false
FEATURE_ORGANIC_CERTIFICATION=true
```

---

## MIGRATION STRATEGY

### Database Migration

**Approach**: Additive only, no destructive changes

1. Create new tables (non-breaking)
2. Add optional columns to existing tables
3. No renaming or dropping
4. Backward compatible with existing data

### Existing User Transition

**Current Users**: Assumed < 100 based on git history

**Plan**:
1. Notify existing users of platform pivot
2. Migrate existing Producer data to work with new OrganicField
3. Link existing certifications to new OrganicCertificate workflow
4. Offer free trial of organic certification features

### API Compatibility

**Approach**: Keep existing endpoints functional

1. New endpoints under existing `/api/v1/` namespace
2. Existing batch/producer endpoints remain unchanged
3. New organic-specific endpoints are additive
4. Document deprecation path for unused endpoints

---

## RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Blockchain RPC failures | Medium | High | Retry mechanism + fallback to draft mode |
| OCR accuracy issues | Medium | Medium | Manual input fallback + confidence thresholds |
| IPFS pinning delays | Low | Low | Async upload, retry queue |
| Mobile GPS inaccuracy | Medium | Medium | Accept 100m tolerance, flag for review |
| Export company churn | High | High | Strong onboarding, quick time-to-value |

---

## SUCCESS METRICS

### Week 1 Milestones
- [ ] Export company can register
- [ ] Admin can invite farmers
- [ ] Farmers can enroll via invitation

### Week 2 Milestones
- [ ] Farmers can create organic fields
- [ ] Farmers can log inspections with photos
- [ ] GPS verification working
- [ ] Receipt OCR functional

### Week 3 Milestones
- [ ] Certificate PDF generation working
- [ ] Blockchain anchoring on Polygon Mumbai
- [ ] IPFS metadata upload working

### Week 4 Milestones
- [ ] Export company dashboard functional
- [ ] Certificate approval flow complete
- [ ] Public verification page live
- [ ] End-to-end flow tested

---

## OPEN QUESTIONS FOR FOUNDER

1. **Mobile App Priority**: Build new Flutter/React Native app or integrate into existing mobile?

2. **Third-Party Certifiers**: Should we integrate with existing certifiers (CCOF, QCS) or operate independently?

3. **White-Label**: Should export companies have fully branded verification pages?

4. **Pricing Model Validation**: $500-2000/mo + $10/cert - need validation from target customers.

5. **Geographic Scope**: Start with Michoacán avocados only, or include berries from Baja California?

6. **Compliance Requirements**: Any specific FSMA, SENASICA, or EU organic regulation requirements?

---

*Roadmap created by Claude (Principal Backend Architect) on 2025-12-24*
