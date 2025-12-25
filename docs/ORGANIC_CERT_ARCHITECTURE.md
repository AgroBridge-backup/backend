# ORGANIC CERTIFICATION ARCHITECTURE DESIGN

**Date**: 2025-12-24
**Version**: 1.0.0
**Status**: Design Phase

---

## 1. EXECUTIVE SUMMARY

This document defines the target architecture for AgroBridge's organic certification infrastructure pivot. The design extends the existing Traceability 2.0 platform to support a B2B2C model where export companies (primary customers) enroll farmer suppliers who use the platform for free while export companies pay SaaS + transaction fees.

---

## 2. CORE CERTIFICATION WORKFLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ORGANIC CERTIFICATION WORKFLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

 PHASE 1: EXPORT COMPANY ONBOARDING
 ══════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  B2B Signup  │────▶│  Configure   │────▶│   Invite     │
 │  (Company)   │     │  Standards   │     │   Farmers    │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ • Company info     │ • USDA Organic     │ • Email list
       │ • RFC/Tax ID       │ • EU Organic       │ • CSV import
       │ • Billing tier     │ • SENASICA         │ • WhatsApp invite
       │                    │                    │
       ▼                    ▼                    ▼

 PHASE 2: FARMER ENROLLMENT (B2B2C)
 ══════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Farmer     │────▶│  Register    │────▶│  Map Fields  │
 │   Receives   │     │  Account     │     │  (GPS/GeoJSON)│
 │   Invite     │     │              │     │              │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ • Email/SMS link   │ • Name, phone      │ • Field boundaries
       │ • Export company   │ • Linked to company│ • Crop type
       │   pre-selected     │ • No payment req   │ • Organic since date
       │                    │                    │
       ▼                    ▼                    ▼

 PHASE 3: FIELD INSPECTION & DATA COLLECTION
 ═══════════════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Weekly     │────▶│  Capture     │────▶│   Log        │
 │   Field      │     │  Evidence    │     │   Activities │
 │   Inspection │     │              │     │              │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ • Open app         │ • Photos + GPS     │ • Planting
       │ • Start inspection │ • Organic inputs   │ • Spraying (organic)
       │ • Walk field       │ • Receipt scan     │ • Harvesting
       │                    │                    │
       ▼                    ▼                    ▼

 PHASE 4: CERTIFICATE GENERATION
 ════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Request    │────▶│  System      │────▶│  Anchor to   │
 │   Certificate│     │  Aggregates  │     │  Blockchain  │
 │              │     │  Data        │     │              │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ • Pre-harvest      │ • Inspection count │ • Hash certificate
       │ • Pre-export       │ • Photo summary    │ • Store on Polygon
       │ • Select fields    │ • Input verification│ • Upload to IPFS
       │                    │                    │
       ▼                    ▼                    ▼

 PHASE 5: CERTIFICATE REVIEW & APPROVAL
 ══════════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Export Co  │────▶│   Review     │────▶│   Approve/   │
 │   Admin      │     │   Audit      │     │   Reject     │
 │   Dashboard  │     │   Trail      │     │              │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ • View pending     │ • All photos       │ • Approve → active
       │ • Farmer details   │ • GPS verification │ • Reject → feedback
       │ • Certificate PDF  │ • Input receipts   │ • Forward to buyer
       │                    │                    │
       ▼                    ▼                    ▼

 PHASE 6: PUBLIC VERIFICATION (TRUST LAYER)
 ══════════════════════════════════════════

 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │   Importer   │────▶│   Verify     │────▶│   Trust      │
 │   Scans QR   │     │   Page       │     │   Badge      │
 └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ • QR on cert/box   │ • Certificate info │ • Blockchain proof
       │ • No login needed  │ • Field photos     │ • USDA/EU logo
       │ • Mobile/desktop   │ • Tx hash link     │ • Verification count
       │                    │                    │
       ▼                    ▼                    ▼
```

---

## 3. NEW DATABASE SCHEMA

### 3.1 Prisma Schema Additions

```prisma
// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT COMPANY (B2B CUSTOMER)
// Primary customer entity for organic certification B2B model
// ═══════════════════════════════════════════════════════════════════════════════

/// Subscription tier for export companies
enum ExportCompanyTier {
  STARTER      // 10 farmers, 50 certs/month, $500/mo
  PROFESSIONAL // 50 farmers, 200 certs/month, $1,000/mo
  ENTERPRISE   // Unlimited farmers, unlimited certs, $2,000/mo
}

/// Export company status
enum ExportCompanyStatus {
  TRIAL        // 14-day trial period
  ACTIVE       // Paying customer
  SUSPENDED    // Payment failed
  CANCELLED    // Churned
}

/// Export company - B2B customer entity
model ExportCompany {
  id                String              @id @default(uuid())

  // Company identification
  name              String
  legalName         String?             // Razón social
  rfc               String              @unique // Mexican tax ID
  email             String              @unique
  phone             String?

  // Address
  country           String              @default("MX")
  state             String?
  city              String?
  address           String?
  postalCode        String?

  // Primary contact
  contactName       String
  contactEmail      String
  contactPhone      String?

  // Subscription & billing
  tier              ExportCompanyTier   @default(STARTER)
  status            ExportCompanyStatus @default(TRIAL)
  trialEndsAt       DateTime?
  monthlyFee        Decimal             @db.Decimal(10, 2)
  certificateFee    Decimal             @db.Decimal(10, 2) @default(10.00) // Per cert overage
  farmersIncluded   Int                 @default(10)
  certsIncluded     Int                 @default(50)

  // Stripe billing
  stripeCustomerId  String?             @unique
  stripeSubscriptionId String?

  // Certification standards enabled
  enabledStandards  CertificationType[]

  // Branding (white-label)
  logoUrl           String?
  primaryColor      String?             @default("#22C55E") // Green

  // Admin users
  adminUsers        User[]              @relation("ExportCompanyAdmins")

  // Farmers enrolled
  farmers           Producer[]          @relation("ExportCompanyFarmers")

  // Certificates issued
  certificates      OrganicCertificate[]

  // Invoices
  invoices          ExportCompanyInvoice[]

  // Farmer invitations
  invitations       FarmerInvitation[]

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([status])
  @@index([tier])
  @@index([stripeCustomerId])
  @@map("export_companies")
}

// ═══════════════════════════════════════════════════════════════════════════════
// FARMER INVITATION
// B2B2C flow: Export company invites farmers via email/SMS
// ═══════════════════════════════════════════════════════════════════════════════

/// Farmer invitation status
enum FarmerInvitationStatus {
  PENDING    // Invitation sent, not accepted
  ACCEPTED   // Farmer completed registration
  EXPIRED    // Invitation expired (7 days)
  CANCELLED  // Export company cancelled
}

/// Farmer invitation record
model FarmerInvitation {
  id                String                  @id @default(uuid())

  exportCompanyId   String
  exportCompany     ExportCompany           @relation(fields: [exportCompanyId], references: [id], onDelete: Cascade)

  // Invitation details
  email             String
  phone             String?
  farmerName        String?                 // Optional pre-fill

  // Security
  inviteToken       String                  @unique // UUID for signup link

  // Status
  status            FarmerInvitationStatus  @default(PENDING)

  // Result
  farmerId          String?                 // Set when farmer registers

  // Timestamps
  sentAt            DateTime                @default(now())
  expiresAt         DateTime                // 7 days from sentAt
  acceptedAt        DateTime?

  @@index([exportCompanyId])
  @@index([inviteToken])
  @@index([email])
  @@index([status])
  @@map("farmer_invitations")
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIC FIELD (Extended from existing Field)
// Extends satellite imagery fields with organic-specific data
// ═══════════════════════════════════════════════════════════════════════════════

/// Organic certification status for a field
enum OrganicFieldStatus {
  PENDING_VERIFICATION  // Newly declared, needs initial inspection
  TRANSITIONAL          // In 36-month transition period
  CERTIFIED             // Fully organic certified
  SUSPENDED             // Certification suspended (violation)
  REVOKED               // Certification revoked
}

/// Extended field entity for organic certification
model OrganicField {
  id                String              @id @default(uuid())

  // Link to base Field entity (if using satellite imagery)
  baseFieldId       String?             @unique
  baseField         Field?              @relation(fields: [baseFieldId], references: [id])

  producerId        String
  producer          Producer            @relation(fields: [producerId], references: [id], onDelete: Cascade)

  // Field identification
  name              String
  localIdentifier   String?             // Farmer's local name for field

  // Crop information
  cropType          String              // AVOCADO, BLUEBERRY, RASPBERRY, STRAWBERRY
  variety           String?             // HASS, ORGANIC_DRISCOLL, etc.

  // Geographic
  areaHectares      Decimal             @db.Decimal(10, 4)
  boundaryGeoJson   String              @db.Text // GeoJSON polygon
  centerLat         Decimal             @db.Decimal(10, 8)
  centerLng         Decimal             @db.Decimal(11, 8)
  altitude          Decimal?            @db.Decimal(6, 2) // Meters above sea level

  // Organic history
  organicSince      DateTime?           // Date organic practices started
  lastConventional  DateTime?           // Last date of conventional inputs
  transitionEndDate DateTime?           // When 36-month transition ends

  // Certification
  certificationStatus OrganicFieldStatus @default(PENDING_VERIFICATION)
  certifiedStandards CertificationType[] // USDA, EU, SENASICA

  // Water sources
  waterSources      String[]            // WELL, RIVER, RAIN, MUNICIPAL
  irrigationType    String?             // DRIP, SPRINKLER, FLOOD

  // Soil information
  soilType          String?
  lastSoilTestDate  DateTime?

  // Inspections
  inspections       FieldInspection[]

  // Active status
  isActive          Boolean             @default(true)

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([producerId])
  @@index([certificationStatus])
  @@index([cropType])
  @@map("organic_fields")
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD INSPECTION
// Weekly/monthly field inspection records with evidence
// ═══════════════════════════════════════════════════════════════════════════════

/// Inspection type
enum InspectionType {
  ROUTINE           // Regular weekly/monthly inspection
  PRE_CERTIFICATION // Before issuing certificate
  AUDIT             // Third-party audit inspection
  COMPLAINT         // Investigation of complaint
}

/// Field inspection record
model FieldInspection {
  id                String            @id @default(uuid())

  fieldId           String
  field             OrganicField      @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  // Inspector
  inspectorId       String            // User who conducted inspection
  inspectorName     String            // Snapshot of name
  inspectorRole     String            // FARMER, QA, CERTIFIER

  // Inspection metadata
  inspectionType    InspectionType    @default(ROUTINE)
  inspectionDate    DateTime
  duration          Int?              // Minutes spent inspecting

  // Evidence
  photos            InspectionPhoto[]

  // Organic inputs used
  organicInputs     OrganicInput[]

  // Activities logged
  activities        FieldActivity[]

  // GPS verification
  inspectorLat      Decimal?          @db.Decimal(10, 8)
  inspectorLng      Decimal?          @db.Decimal(11, 8)
  gpsAccuracy       Decimal?          @db.Decimal(6, 2) // Meters
  gpsVerified       Boolean           @default(false)   // Within field boundary

  // Weather conditions
  weatherCondition  String?           // SUNNY, CLOUDY, RAINY
  temperature       Decimal?          @db.Decimal(5, 2)

  // Inspector notes
  notes             String?           @db.Text
  issues            String?           @db.Text // Any problems found
  recommendations   String?           @db.Text

  // Verification status
  isVerified        Boolean           @default(false)
  verifiedBy        String?
  verifiedAt        DateTime?

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([fieldId])
  @@index([inspectionDate])
  @@index([inspectorId])
  @@map("field_inspections")
}

/// Inspection photo with GPS metadata
model InspectionPhoto {
  id                String            @id @default(uuid())

  inspectionId      String
  inspection        FieldInspection   @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  // Photo storage
  imageUrl          String
  thumbnailUrl      String?

  // GPS from photo EXIF or capture location
  latitude          Decimal?          @db.Decimal(10, 8)
  longitude         Decimal?          @db.Decimal(11, 8)
  altitude          Decimal?          @db.Decimal(6, 2)

  // Time captured
  capturedAt        DateTime

  // Metadata
  caption           String?
  photoType         String?           // CROP, INPUT, PRACTICE, ISSUE

  // GPS verification
  withinFieldBoundary Boolean         @default(false)
  distanceFromField Decimal?          @db.Decimal(8, 2) // Meters if outside

  createdAt         DateTime          @default(now())

  @@index([inspectionId])
  @@map("inspection_photos")
}

/// Organic input (fertilizer, pesticide) record
model OrganicInput {
  id                String            @id @default(uuid())

  inspectionId      String
  inspection        FieldInspection   @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  // Input identification
  productName       String
  brandName         String?
  manufacturer      String?

  // Classification
  inputType         String            // FERTILIZER, PESTICIDE, HERBICIDE, AMENDMENT

  // Certification
  isOmriListed      Boolean           @default(false) // OMRI organic certified
  isOrganicApproved Boolean           @default(false)
  certificationNumber String?

  // Purchase evidence
  receiptUrl        String?
  receiptDate       DateTime?
  quantity          String?           // e.g., "5 liters", "20 kg"
  supplier          String?

  // OCR data (from receipt scan)
  ocrExtractedData  Json?
  ocrConfidence     Decimal?          @db.Decimal(3, 2) // 0.00-1.00

  // Verification
  verificationStatus String           @default("PENDING") // PENDING, VERIFIED, REJECTED
  verifiedBy        String?
  verifiedAt        DateTime?
  rejectionReason   String?

  createdAt         DateTime          @default(now())

  @@index([inspectionId])
  @@index([inputType])
  @@index([verificationStatus])
  @@map("organic_inputs")
}

/// Field activity (planting, spraying, harvesting)
model FieldActivity {
  id                String            @id @default(uuid())

  inspectionId      String
  inspection        FieldInspection   @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  // Activity details
  activityType      String            // PLANTING, SPRAYING, HARVESTING, PRUNING, IRRIGATION, WEEDING
  description       String?

  // Timing
  activityDate      DateTime
  duration          Int?              // Minutes

  // Area covered
  areaCovered       Decimal?          @db.Decimal(10, 4) // Hectares

  // Workers involved
  workerCount       Int?

  // Notes
  notes             String?           @db.Text

  createdAt         DateTime          @default(now())

  @@index([inspectionId])
  @@index([activityType])
  @@map("field_activities")
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIC CERTIFICATE
// The core deliverable - blockchain-anchored organic certification
// ═══════════════════════════════════════════════════════════════════════════════

/// Organic certificate status
enum OrganicCertificateStatus {
  DRAFT             // Certificate created, not submitted
  PENDING_REVIEW    // Submitted, awaiting export company review
  APPROVED          // Export company approved
  REJECTED          // Export company rejected
  REVOKED           // Certificate revoked post-approval
}

/// Organic certificate - the core deliverable
model OrganicCertificate {
  id                    String                    @id @default(uuid())

  // Certificate number
  certificateNumber     String                    @unique // AGB-MX-2025-001234

  // Parties
  farmerId              String
  farmer                Producer                  @relation("FarmerCertificates", fields: [farmerId], references: [id])

  exportCompanyId       String
  exportCompany         ExportCompany             @relation(fields: [exportCompanyId], references: [id])

  // Fields covered
  fieldIds              String[]                  // Array of OrganicField IDs

  // Crop information
  cropType              String                    // AVOCADO, BLUEBERRY, etc.
  variety               String?
  harvestDate           DateTime?
  estimatedWeight       Decimal?                  @db.Decimal(10, 2) // kg

  // Certification standard
  certificationStandard CertificationType         // ORGANIC_USDA, ORGANIC_EU, SENASICA

  // Validity
  validFrom             DateTime
  validTo               DateTime

  // Status workflow
  status                OrganicCertificateStatus  @default(DRAFT)

  // Review
  submittedAt           DateTime?
  reviewedBy            String?
  reviewedAt            DateTime?
  rejectionReason       String?                   @db.Text

  // Generated files
  pdfUrl                String?
  qrCodeUrl             String?
  qrCodeShortUrl        String?                   // Short URL for QR

  // Blockchain anchoring
  contentHash           String?                   // SHA-256 of certificate payload
  blockchainTxHash      String?
  blockchainNetwork     String?                   @default("polygon")
  blockchainTimestamp   DateTime?

  // IPFS storage
  ipfsHash              String?                   // CID for full metadata

  // Payload snapshot (for hash verification)
  payloadSnapshot       String?                   @db.Text

  // Verification stats
  viewCount             Int                       @default(0)
  lastViewedAt          DateTime?

  // Verification logs
  verifications         CertificateVerification[]

  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  @@index([farmerId])
  @@index([exportCompanyId])
  @@index([status])
  @@index([certificateNumber])
  @@index([certificationStandard])
  @@map("organic_certificates")
}

/// Certificate verification log (QR scans)
model CertificateVerification {
  id                String              @id @default(uuid())

  certificateId     String
  certificate       OrganicCertificate  @relation(fields: [certificateId], references: [id], onDelete: Cascade)

  // Verification context
  verifierType      String?             // IMPORTER, RETAILER, AUDITOR, CONSUMER

  // Privacy-safe tracking (no PII)
  country           String?             // From geoIP
  deviceType        String?             // MOBILE, DESKTOP
  referrer          String?

  verifiedAt        DateTime            @default(now())

  @@index([certificateId])
  @@index([verifiedAt])
  @@map("certificate_verifications")
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT COMPANY BILLING
// Monthly SaaS invoices for export companies
// ═══════════════════════════════════════════════════════════════════════════════

/// Export company invoice
model ExportCompanyInvoice {
  id                String          @id @default(uuid())

  exportCompanyId   String
  exportCompany     ExportCompany   @relation(fields: [exportCompanyId], references: [id])

  // Invoice number
  invoiceNumber     String          @unique // INV-2025-0001

  // Period
  periodStart       DateTime
  periodEnd         DateTime

  // Line items (denormalized for invoice record)
  baseFee           Decimal         @db.Decimal(10, 2)
  farmerCount       Int
  certificateCount  Int
  overageCerts      Int             @default(0)
  overageFees       Decimal         @db.Decimal(10, 2) @default(0)

  // Totals
  subtotal          Decimal         @db.Decimal(10, 2)
  tax               Decimal         @db.Decimal(10, 2) @default(0)
  total             Decimal         @db.Decimal(10, 2)
  currency          String          @default("USD")

  // Status
  status            String          @default("DRAFT") // DRAFT, SENT, PAID, OVERDUE, CANCELLED

  // Payment
  stripeInvoiceId   String?
  paidAt            DateTime?
  paymentMethod     String?

  // PDF
  pdfUrl            String?

  dueDate           DateTime
  createdAt         DateTime        @default(now())

  @@index([exportCompanyId])
  @@index([status])
  @@index([periodStart, periodEnd])
  @@map("export_company_invoices")
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTEND EXISTING MODELS
// ═══════════════════════════════════════════════════════════════════════════════

// Add to Producer model:
// exportCompanyId    String?
// exportCompany      ExportCompany?  @relation("ExportCompanyFarmers", fields: [exportCompanyId], references: [id])
// organicFields      OrganicField[]
// organicCertificates OrganicCertificate[] @relation("FarmerCertificates")

// Add to User model:
// exportCompanyAdminOf ExportCompany? @relation("ExportCompanyAdmins", fields: [exportCompanyAdminId], references: [id])
// exportCompanyAdminId String?

// Add to Field model:
// organicField       OrganicField?
```

---

## 4. NEW API ENDPOINTS

### 4.1 Export Company Management (B2B)

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT COMPANY REGISTRATION & MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// B2B Signup
POST   /api/v1/export-companies/register
Request: {
  name: string;
  legalName?: string;
  rfc: string;
  email: string;
  contactName: string;
  contactEmail: string;
  tier: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  enabledStandards: ("ORGANIC_USDA" | "ORGANIC_EU" | "SENASICA")[];
}
Response: {
  exportCompany: ExportCompany;
  adminUser: User;
  trialEndsAt: Date;
}

// Get own company profile
GET    /api/v1/export-companies/me
Auth: EXPORT_COMPANY_ADMIN
Response: {
  company: ExportCompany;
  usage: { farmers: number; certificates: number; };
  subscription: { tier, status, nextBillingDate };
}

// Update company profile
PUT    /api/v1/export-companies/me
Auth: EXPORT_COMPANY_ADMIN
Request: { name?, contactName?, logoUrl?, primaryColor? }

// ═══════════════════════════════════════════════════════════════════════════════
// FARMER ENROLLMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Invite farmers (bulk)
POST   /api/v1/export-companies/me/farmers/invite
Auth: EXPORT_COMPANY_ADMIN
Request: {
  invitations: Array<{ email: string; phone?: string; name?: string; }>;
}
Response: {
  sent: number;
  failed: Array<{ email: string; reason: string; }>;
}

// List enrolled farmers
GET    /api/v1/export-companies/me/farmers
Auth: EXPORT_COMPANY_ADMIN
Query: { page, limit, search, status }
Response: {
  farmers: Array<{ id, name, email, fieldCount, certificateCount, lastActive }>;
  pagination: { total, page, limit };
}

// Get farmer details
GET    /api/v1/export-companies/me/farmers/:farmerId
Auth: EXPORT_COMPANY_ADMIN
Response: {
  farmer: Producer;
  fields: OrganicField[];
  inspections: FieldInspection[];
  certificates: OrganicCertificate[];
}

// Accept invitation (farmer side)
POST   /api/v1/farmers/enroll
Request: {
  inviteToken: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}
Response: {
  user: User;
  producer: Producer;
  exportCompany: { id, name };
  accessToken: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT COMPANY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// Dashboard stats
GET    /api/v1/export-companies/me/dashboard
Auth: EXPORT_COMPANY_ADMIN
Response: {
  farmers: { total, active, inactive };
  certificates: { total, pending, approved, rejected, thisMonth };
  fields: { total, hectares, byCrop: { [crop]: count } };
  inspections: { thisMonth, avgPerFarmer };
  billing: { currentMonthFee, certificateFees, totalDue };
}

// Pending certificates for review
GET    /api/v1/export-companies/me/certificates/pending
Auth: EXPORT_COMPANY_ADMIN
Response: {
  certificates: OrganicCertificate[];
}

// Approve certificate
POST   /api/v1/export-companies/me/certificates/:id/approve
Auth: EXPORT_COMPANY_ADMIN
Response: {
  certificate: OrganicCertificate;
  pdfUrl: string;
  qrCodeUrl: string;
}

// Reject certificate
POST   /api/v1/export-companies/me/certificates/:id/reject
Auth: EXPORT_COMPANY_ADMIN
Request: { reason: string; }
Response: {
  certificate: OrganicCertificate;
}
```

### 4.2 Farmer Mobile Endpoints

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIC FIELD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// List farmer's fields
GET    /api/v1/farmers/me/organic-fields
Auth: PRODUCER
Response: {
  fields: OrganicField[];
}

// Create new field
POST   /api/v1/farmers/me/organic-fields
Auth: PRODUCER
Request: {
  name: string;
  cropType: string;
  variety?: string;
  areaHectares: number;
  boundaryGeoJson: GeoJSON;
  organicSince?: Date;
  waterSources: string[];
}
Response: {
  field: OrganicField;
}

// Update field
PUT    /api/v1/farmers/me/organic-fields/:id
Auth: PRODUCER
Request: { ... }

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD INSPECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Create inspection
POST   /api/v1/farmers/me/organic-fields/:fieldId/inspections
Auth: PRODUCER
Request: {
  inspectionType: "ROUTINE" | "PRE_CERTIFICATION";
  inspectionDate: Date;
  inspectorLat?: number;
  inspectorLng?: number;
  notes?: string;
  weatherCondition?: string;
}
Response: {
  inspection: FieldInspection;
}

// Upload inspection photo
POST   /api/v1/inspections/:inspectionId/photos
Auth: PRODUCER
Request: (multipart/form-data) {
  photo: File;
  latitude?: number;
  longitude?: number;
  caption?: string;
  photoType?: string;
}
Response: {
  photo: InspectionPhoto;
  gpsVerification: { withinField: boolean; distance?: number; };
}

// Add organic input
POST   /api/v1/inspections/:inspectionId/inputs
Auth: PRODUCER
Request: {
  productName: string;
  brandName?: string;
  inputType: string;
  receiptUrl?: string;
  receiptDate?: Date;
  quantity?: string;
  supplier?: string;
}
Response: {
  input: OrganicInput;
}

// Scan receipt (OCR)
POST   /api/v1/inspections/:inspectionId/inputs/scan-receipt
Auth: PRODUCER
Request: (multipart/form-data) { receipt: File; }
Response: {
  extractedData: {
    productName?: string;
    brandName?: string;
    date?: Date;
    quantity?: string;
    supplier?: string;
    isOrganic?: boolean;
    confidence: number;
  };
  receiptUrl: string;
}

// Add activity
POST   /api/v1/inspections/:inspectionId/activities
Auth: PRODUCER
Request: {
  activityType: string;
  description?: string;
  activityDate: Date;
  duration?: number;
  areaCovered?: number;
}
Response: {
  activity: FieldActivity;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATE REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

// Request certificate
POST   /api/v1/farmers/me/certificates/request
Auth: PRODUCER
Request: {
  fieldIds: string[];
  cropType: string;
  certificationStandard: "ORGANIC_USDA" | "ORGANIC_EU" | "SENASICA";
  harvestDate?: Date;
  estimatedWeight?: number;
  notes?: string;
}
Response: {
  certificate: OrganicCertificate;
  status: "PENDING_REVIEW";
  requiredInspections: { min: number; actual: number; };
}

// List farmer's certificates
GET    /api/v1/farmers/me/certificates
Auth: PRODUCER
Query: { status?, page, limit }
Response: {
  certificates: OrganicCertificate[];
  pagination: { total, page, limit };
}
```

### 4.3 Public Verification API

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC VERIFICATION (NO AUTH)
// ═══════════════════════════════════════════════════════════════════════════════

// Verify organic certificate (QR target)
GET    /api/v1/verify/organic/:certificateNumber
Auth: NONE
Response: {
  valid: boolean;
  certificate: {
    certificateNumber: string;
    status: string;
    farmInfo: {
      name: string; // First name + initial
      location: string; // State, Mexico
      cropType: string;
      variety?: string;
      hectares: number;
    };
    certification: {
      standard: string;
      standardLogo: string; // URL to USDA/EU logo
      harvestDate?: Date;
      validFrom: Date;
      validTo: Date;
    };
    blockchain: {
      network: string;
      txHash?: string;
      explorerUrl?: string;
      timestamp?: Date;
    };
    ipfs: {
      cid?: string;
      gatewayUrl?: string;
    };
    exportCompany: {
      name: string;
      country: string;
    };
    inspectionSummary: {
      totalInspections: number;
      photosCount: number;
      organicInputsVerified: number;
      lastInspectionDate: Date;
    };
    verificationStats: {
      viewCount: number;
      lastViewedAt?: Date;
    };
  };
}

// Log verification view (for analytics)
POST   /api/v1/verify/organic/:certificateNumber/log
Auth: NONE
Request: {
  verifierType?: string;
  referrer?: string;
}
Response: { success: true; }
```

---

## 5. DOMAIN SERVICES

### 5.1 OrganicCertificateService

```typescript
// Location: apps/api/src/domain/services/OrganicCertificateService.ts

export class OrganicCertificateService {
  constructor(
    private prisma: PrismaClient,
    private certificateRepository: IOrganicCertificateRepository,
    private fieldRepository: IOrganicFieldRepository,
    private inspectionRepository: IFieldInspectionRepository,
    private blockchainService: BlockchainService,
    private ipfsService: IPFSService,
    private pdfService: PDFService,
    private qrService: QRCodeService,
  ) {}

  /**
   * Request a new organic certificate
   */
  async requestCertificate(input: RequestCertificateInput): Promise<OrganicCertificate>;

  /**
   * Generate certificate PDF with QR code
   */
  async generateCertificatePDF(certificateId: string): Promise<string>;

  /**
   * Anchor certificate to blockchain
   */
  async anchorToBlockchain(certificateId: string): Promise<BlockchainAnchorResult>;

  /**
   * Upload certificate metadata to IPFS
   */
  async uploadToIPFS(certificateId: string): Promise<string>;

  /**
   * Approve certificate (export company admin)
   */
  async approveCertificate(certificateId: string, approvedBy: string): Promise<OrganicCertificate>;

  /**
   * Reject certificate with reason
   */
  async rejectCertificate(certificateId: string, reason: string, rejectedBy: string): Promise<OrganicCertificate>;

  /**
   * Verify certificate authenticity
   */
  async verifyCertificate(certificateNumber: string): Promise<VerificationResult>;

  /**
   * Check if farmer can request certificate
   */
  async canRequestCertificate(farmerId: string, fieldIds: string[], standard: CertificationType): Promise<EligibilityResult>;

  /**
   * Generate certificate number
   */
  private generateCertificateNumber(): string;

  /**
   * Build certificate payload for hashing
   */
  private buildCertificatePayload(certificate: OrganicCertificate): CertificatePayload;

  /**
   * Compute SHA-256 hash of payload
   */
  private computeHash(payload: string): string;
}
```

### 5.2 FieldInspectionService

```typescript
// Location: apps/api/src/domain/services/FieldInspectionService.ts

export class FieldInspectionService {
  constructor(
    private prisma: PrismaClient,
    private inspectionRepository: IFieldInspectionRepository,
    private photoRepository: IInspectionPhotoRepository,
    private inputRepository: IOrganicInputRepository,
    private storageService: StorageService,
    private ocrService: OCRService,
    private geoService: GeoVerificationService,
  ) {}

  /**
   * Create field inspection
   */
  async createInspection(fieldId: string, data: CreateInspectionInput): Promise<FieldInspection>;

  /**
   * Upload and process inspection photo
   */
  async uploadPhoto(inspectionId: string, file: File, metadata: PhotoMetadata): Promise<InspectionPhoto>;

  /**
   * Verify GPS coordinates within field boundary
   */
  async verifyGPSWithinField(fieldId: string, lat: number, lng: number): Promise<GPSVerificationResult>;

  /**
   * Add organic input record
   */
  async addOrganicInput(inspectionId: string, input: OrganicInputData): Promise<OrganicInput>;

  /**
   * Process receipt with OCR
   */
  async processReceipt(imageUrl: string): Promise<OCRResult>;

  /**
   * Verify organic input is approved
   */
  async verifyOrganicInput(inputId: string): Promise<VerificationResult>;

  /**
   * Get inspection summary for certificate
   */
  async getInspectionSummary(fieldIds: string[], dateRange: DateRange): Promise<InspectionSummary>;
}
```

### 5.3 ExportCompanyService

```typescript
// Location: apps/api/src/domain/services/ExportCompanyService.ts

export class ExportCompanyService {
  constructor(
    private prisma: PrismaClient,
    private companyRepository: IExportCompanyRepository,
    private invitationRepository: IFarmerInvitationRepository,
    private billingService: BillingService,
    private emailService: EmailService,
  ) {}

  /**
   * Register new export company
   */
  async registerCompany(data: RegisterCompanyInput): Promise<ExportCompany>;

  /**
   * Invite farmers to enroll
   */
  async inviteFarmers(companyId: string, invitations: FarmerInvitationInput[]): Promise<InvitationResult>;

  /**
   * Process farmer enrollment from invitation
   */
  async enrollFarmer(inviteToken: string, farmerData: FarmerEnrollmentInput): Promise<EnrollmentResult>;

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(companyId: string): Promise<DashboardStats>;

  /**
   * Generate monthly invoice
   */
  async generateInvoice(companyId: string, period: DateRange): Promise<ExportCompanyInvoice>;

  /**
   * Check subscription limits
   */
  async checkLimits(companyId: string): Promise<LimitCheckResult>;

  /**
   * Upgrade/downgrade subscription tier
   */
  async changeTier(companyId: string, newTier: ExportCompanyTier): Promise<ExportCompany>;
}
```

---

## 6. BLOCKCHAIN INTEGRATION

### 6.1 Organic Certificate Smart Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OrganicCertificateRegistry
 * @notice On-chain registry for organic certification proofs
 * @dev Stores certificate hashes with revocation support
 */
contract OrganicCertificateRegistry is AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    struct Certificate {
        bytes32 contentHash;      // SHA-256 of certificate PDF
        string ipfsCid;           // IPFS CID for full metadata
        string certificationStandard; // USDA_ORGANIC, EU_ORGANIC, SENASICA
        address issuer;           // AgroBridge issuer wallet
        uint256 issuedAt;         // Block timestamp
        uint256 validFrom;        // Certificate validity start
        uint256 validTo;          // Certificate validity end
        bool revoked;             // Revocation status
        uint256 revokedAt;        // Revocation timestamp
        string revocationReason;  // Reason for revocation
    }

    // certificateNumber => Certificate
    mapping(string => Certificate) public certificates;

    // Track all certificate numbers for enumeration
    string[] public certificateNumbers;

    // Events
    event CertificateIssued(
        string indexed certificateNumber,
        bytes32 contentHash,
        string ipfsCid,
        string certificationStandard,
        address indexed issuer,
        uint256 validFrom,
        uint256 validTo
    );

    event CertificateRevoked(
        string indexed certificateNumber,
        address indexed revoker,
        string reason,
        uint256 revokedAt
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);
    }

    /**
     * @notice Issue a new organic certificate
     */
    function issueCertificate(
        string calldata certificateNumber,
        bytes32 contentHash,
        string calldata ipfsCid,
        string calldata certificationStandard,
        uint256 validFrom,
        uint256 validTo
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        require(
            certificates[certificateNumber].issuedAt == 0,
            "Certificate already exists"
        );
        require(validTo > validFrom, "Invalid validity period");
        require(validTo > block.timestamp, "Already expired");

        certificates[certificateNumber] = Certificate({
            contentHash: contentHash,
            ipfsCid: ipfsCid,
            certificationStandard: certificationStandard,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            validFrom: validFrom,
            validTo: validTo,
            revoked: false,
            revokedAt: 0,
            revocationReason: ""
        });

        certificateNumbers.push(certificateNumber);

        emit CertificateIssued(
            certificateNumber,
            contentHash,
            ipfsCid,
            certificationStandard,
            msg.sender,
            validFrom,
            validTo
        );
    }

    /**
     * @notice Revoke a certificate
     */
    function revokeCertificate(
        string calldata certificateNumber,
        string calldata reason
    ) external onlyRole(REVOKER_ROLE) {
        Certificate storage cert = certificates[certificateNumber];
        require(cert.issuedAt != 0, "Certificate does not exist");
        require(!cert.revoked, "Already revoked");

        cert.revoked = true;
        cert.revokedAt = block.timestamp;
        cert.revocationReason = reason;

        emit CertificateRevoked(
            certificateNumber,
            msg.sender,
            reason,
            block.timestamp
        );
    }

    /**
     * @notice Verify a certificate
     */
    function verifyCertificate(
        string calldata certificateNumber
    ) external view returns (
        bool exists,
        bool valid,
        bytes32 contentHash,
        string memory ipfsCid,
        uint256 issuedAt,
        uint256 validFrom,
        uint256 validTo,
        bool revoked
    ) {
        Certificate storage cert = certificates[certificateNumber];

        exists = cert.issuedAt != 0;

        if (!exists) {
            return (false, false, bytes32(0), "", 0, 0, 0, false);
        }

        valid = !cert.revoked &&
                block.timestamp >= cert.validFrom &&
                block.timestamp <= cert.validTo;

        return (
            exists,
            valid,
            cert.contentHash,
            cert.ipfsCid,
            cert.issuedAt,
            cert.validFrom,
            cert.validTo,
            cert.revoked
        );
    }

    /**
     * @notice Get total certificate count
     */
    function getCertificateCount() external view returns (uint256) {
        return certificateNumbers.length;
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
```

### 6.2 Deployment Configuration

```typescript
// Location: apps/api/src/infrastructure/blockchain/config.ts

export const BLOCKCHAIN_CONFIG = {
  polygon: {
    mainnet: {
      chainId: 137,
      rpcUrl: process.env.POLYGON_MAINNET_RPC_URL || 'https://polygon-rpc.com',
      explorerUrl: 'https://polygonscan.com',
      gasLimit: 500000,
    },
    mumbai: {
      chainId: 80001,
      rpcUrl: process.env.POLYGON_MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
      explorerUrl: 'https://mumbai.polygonscan.com',
      gasLimit: 500000,
    },
  },
  contracts: {
    organicCertificateRegistry: process.env.ORGANIC_CERT_REGISTRY_ADDRESS,
  },
};
```

---

## 7. NEXT STEPS

See `IMPLEMENTATION_ROADMAP.md` for the 4-week sprint plan.

---

*Architecture designed by Claude (Principal Backend Architect) on 2025-12-24*
