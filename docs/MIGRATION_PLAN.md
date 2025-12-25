# MIGRATION PLAN: ORGANIC CERTIFICATION PIVOT

**Date**: 2025-12-24
**Version**: 1.0.0

---

## 1. OVERVIEW

This document outlines the migration strategy for transitioning AgroBridge from a generic farm management platform to an organic certification infrastructure focused on Mexican avocado/berry exports.

**Key Principles**:
- Additive-only database changes (no destructive migrations)
- Backward compatibility with existing functionality
- Zero downtime deployment
- Gradual feature rollout via feature flags

---

## 2. DATABASE MIGRATION SCRIPTS

### 2.1 Migration 001: Export Company Entity

```sql
-- Migration: 001_create_export_companies
-- Description: Create export company table for B2B customers

CREATE TYPE export_company_tier AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE export_company_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

CREATE TABLE export_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    rfc VARCHAR(13) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    country VARCHAR(2) DEFAULT 'MX',
    state VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    postal_code VARCHAR(10),
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    tier export_company_tier DEFAULT 'STARTER',
    status export_company_status DEFAULT 'TRIAL',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    monthly_fee DECIMAL(10,2) NOT NULL,
    certificate_fee DECIMAL(10,2) DEFAULT 10.00,
    farmers_included INT DEFAULT 10,
    certs_included INT DEFAULT 50,
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    enabled_standards TEXT[], -- Array of CertificationType enum values
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#22C55E',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_export_companies_status ON export_companies(status);
CREATE INDEX idx_export_companies_tier ON export_companies(tier);
CREATE INDEX idx_export_companies_stripe ON export_companies(stripe_customer_id);

-- Trigger for updated_at
CREATE TRIGGER update_export_companies_updated_at
    BEFORE UPDATE ON export_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 Migration 002: Farmer Invitations

```sql
-- Migration: 002_create_farmer_invitations
-- Description: Create farmer invitation table for B2B2C enrollment

CREATE TYPE farmer_invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE farmer_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_company_id UUID NOT NULL REFERENCES export_companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    farmer_name VARCHAR(255),
    invite_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    status farmer_invitation_status DEFAULT 'PENDING',
    farmer_id UUID, -- Set when farmer registers
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_farmer_invitations_company ON farmer_invitations(export_company_id);
CREATE INDEX idx_farmer_invitations_token ON farmer_invitations(invite_token);
CREATE INDEX idx_farmer_invitations_email ON farmer_invitations(email);
CREATE INDEX idx_farmer_invitations_status ON farmer_invitations(status);
```

### 2.3 Migration 003: Extend Producer for Export Company

```sql
-- Migration: 003_extend_producer_export_company
-- Description: Add export company linkage to producers

ALTER TABLE producers
    ADD COLUMN export_company_id UUID REFERENCES export_companies(id),
    ADD COLUMN enrolled_via_invitation_id UUID REFERENCES farmer_invitations(id);

CREATE INDEX idx_producers_export_company ON producers(export_company_id);
```

### 2.4 Migration 004: Organic Fields

```sql
-- Migration: 004_create_organic_fields
-- Description: Create organic field table with GeoJSON boundaries

CREATE TYPE organic_field_status AS ENUM (
    'PENDING_VERIFICATION',
    'TRANSITIONAL',
    'CERTIFIED',
    'SUSPENDED',
    'REVOKED'
);

CREATE TABLE organic_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_field_id UUID UNIQUE REFERENCES fields(id),
    producer_id UUID NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    local_identifier VARCHAR(100),
    crop_type VARCHAR(50) NOT NULL,
    variety VARCHAR(100),
    area_hectares DECIMAL(10,4) NOT NULL,
    boundary_geojson TEXT NOT NULL, -- GeoJSON polygon
    center_lat DECIMAL(10,8) NOT NULL,
    center_lng DECIMAL(11,8) NOT NULL,
    altitude DECIMAL(6,2),
    organic_since TIMESTAMP WITH TIME ZONE,
    last_conventional TIMESTAMP WITH TIME ZONE,
    transition_end_date TIMESTAMP WITH TIME ZONE,
    certification_status organic_field_status DEFAULT 'PENDING_VERIFICATION',
    certified_standards TEXT[], -- Array of CertificationType
    water_sources TEXT[],
    irrigation_type VARCHAR(50),
    soil_type VARCHAR(100),
    last_soil_test_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organic_fields_producer ON organic_fields(producer_id);
CREATE INDEX idx_organic_fields_status ON organic_fields(certification_status);
CREATE INDEX idx_organic_fields_crop ON organic_fields(crop_type);
```

### 2.5 Migration 005: Field Inspections

```sql
-- Migration: 005_create_field_inspections
-- Description: Create field inspection and related tables

CREATE TYPE inspection_type AS ENUM ('ROUTINE', 'PRE_CERTIFICATION', 'AUDIT', 'COMPLAINT');

CREATE TABLE field_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES organic_fields(id) ON DELETE CASCADE,
    inspector_id UUID NOT NULL,
    inspector_name VARCHAR(255) NOT NULL,
    inspector_role VARCHAR(50) NOT NULL,
    inspection_type inspection_type DEFAULT 'ROUTINE',
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INT, -- Minutes
    inspector_lat DECIMAL(10,8),
    inspector_lng DECIMAL(11,8),
    gps_accuracy DECIMAL(6,2),
    gps_verified BOOLEAN DEFAULT FALSE,
    weather_condition VARCHAR(50),
    temperature DECIMAL(5,2),
    notes TEXT,
    issues TEXT,
    recommendations TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_field_inspections_field ON field_inspections(field_id);
CREATE INDEX idx_field_inspections_date ON field_inspections(inspection_date);
CREATE INDEX idx_field_inspections_inspector ON field_inspections(inspector_id);

-- Inspection Photos
CREATE TABLE inspection_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES field_inspections(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    altitude DECIMAL(6,2),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    caption VARCHAR(500),
    photo_type VARCHAR(50),
    within_field_boundary BOOLEAN DEFAULT FALSE,
    distance_from_field DECIMAL(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inspection_photos_inspection ON inspection_photos(inspection_id);

-- Organic Inputs
CREATE TABLE organic_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES field_inspections(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255),
    manufacturer VARCHAR(255),
    input_type VARCHAR(50) NOT NULL,
    is_omri_listed BOOLEAN DEFAULT FALSE,
    is_organic_approved BOOLEAN DEFAULT FALSE,
    certification_number VARCHAR(100),
    receipt_url VARCHAR(500),
    receipt_date TIMESTAMP WITH TIME ZONE,
    quantity VARCHAR(100),
    supplier VARCHAR(255),
    ocr_extracted_data JSONB,
    ocr_confidence DECIMAL(3,2),
    verification_status VARCHAR(20) DEFAULT 'PENDING',
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organic_inputs_inspection ON organic_inputs(inspection_id);
CREATE INDEX idx_organic_inputs_type ON organic_inputs(input_type);
CREATE INDEX idx_organic_inputs_status ON organic_inputs(verification_status);

-- Field Activities
CREATE TABLE field_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES field_inspections(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INT,
    area_covered DECIMAL(10,4),
    worker_count INT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_field_activities_inspection ON field_activities(inspection_id);
CREATE INDEX idx_field_activities_type ON field_activities(activity_type);
```

### 2.6 Migration 006: Organic Certificates

```sql
-- Migration: 006_create_organic_certificates
-- Description: Create organic certificate and verification tables

CREATE TYPE organic_certificate_status AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVOKED'
);

CREATE TABLE organic_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    farmer_id UUID NOT NULL REFERENCES producers(id),
    export_company_id UUID NOT NULL REFERENCES export_companies(id),
    field_ids TEXT[] NOT NULL,
    crop_type VARCHAR(50) NOT NULL,
    variety VARCHAR(100),
    harvest_date TIMESTAMP WITH TIME ZONE,
    estimated_weight DECIMAL(10,2),
    certification_standard VARCHAR(50) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    status organic_certificate_status DEFAULT 'DRAFT',
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    pdf_url VARCHAR(500),
    qr_code_url VARCHAR(500),
    qr_code_short_url VARCHAR(100),
    content_hash VARCHAR(64),
    blockchain_tx_hash VARCHAR(66),
    blockchain_network VARCHAR(20) DEFAULT 'polygon',
    blockchain_timestamp TIMESTAMP WITH TIME ZONE,
    ipfs_hash VARCHAR(100),
    payload_snapshot TEXT,
    view_count INT DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organic_certificates_farmer ON organic_certificates(farmer_id);
CREATE INDEX idx_organic_certificates_company ON organic_certificates(export_company_id);
CREATE INDEX idx_organic_certificates_status ON organic_certificates(status);
CREATE INDEX idx_organic_certificates_number ON organic_certificates(certificate_number);
CREATE INDEX idx_organic_certificates_standard ON organic_certificates(certification_standard);

-- Certificate Verifications (QR scans)
CREATE TABLE certificate_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES organic_certificates(id) ON DELETE CASCADE,
    verifier_type VARCHAR(50),
    country VARCHAR(2),
    device_type VARCHAR(20),
    referrer VARCHAR(500),
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_certificate_verifications_cert ON certificate_verifications(certificate_id);
CREATE INDEX idx_certificate_verifications_time ON certificate_verifications(verified_at);
```

### 2.7 Migration 007: Export Company Invoices

```sql
-- Migration: 007_create_export_company_invoices
-- Description: Create billing invoices for export companies

CREATE TABLE export_company_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_company_id UUID NOT NULL REFERENCES export_companies(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    base_fee DECIMAL(10,2) NOT NULL,
    farmer_count INT NOT NULL,
    certificate_count INT NOT NULL,
    overage_certs INT DEFAULT 0,
    overage_fees DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'DRAFT',
    stripe_invoice_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    pdf_url VARCHAR(500),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_export_invoices_company ON export_company_invoices(export_company_id);
CREATE INDEX idx_export_invoices_status ON export_company_invoices(status);
CREATE INDEX idx_export_invoices_period ON export_company_invoices(period_start, period_end);
```

### 2.8 Migration 008: Extend User for Export Company Admin

```sql
-- Migration: 008_extend_user_export_company
-- Description: Add export company admin relationship to users

ALTER TABLE users
    ADD COLUMN export_company_admin_id UUID REFERENCES export_companies(id);

CREATE INDEX idx_users_export_company ON users(export_company_admin_id);

-- Add EXPORT_COMPANY_ADMIN to role enum (if using enum)
-- ALTER TYPE user_role ADD VALUE 'EXPORT_COMPANY_ADMIN';
```

---

## 3. PRISMA MIGRATION COMMANDS

```bash
# Generate migrations from schema changes
cd apps/api
npx prisma migrate dev --name organic_cert_foundation

# Preview migration SQL
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datamodel prisma/schema-new.prisma \
  --script

# Apply to production
npx prisma migrate deploy

# Reset development database (if needed)
npx prisma migrate reset
```

---

## 4. EXISTING DATA TRANSITION

### 4.1 Producer Data Migration

**Current Producers**: Keep all existing producer data intact.

**Transition Script**:
```typescript
// scripts/migrate-producers-to-organic.ts

async function migrateProducersToOrganicFields() {
  const producers = await prisma.producer.findMany({
    include: { fields: true },
  });

  for (const producer of producers) {
    // Skip if no existing fields
    if (!producer.fields?.length) continue;

    for (const field of producer.fields) {
      // Create organic field record
      await prisma.organicField.create({
        data: {
          baseFieldId: field.id,
          producerId: producer.id,
          name: field.name || `Field ${field.id.slice(-6)}`,
          cropType: field.cropType || 'UNKNOWN',
          areaHectares: field.areaHectares || 0,
          boundaryGeoJson: field.geoJson || '{}',
          centerLat: field.centerLat || 0,
          centerLng: field.centerLng || 0,
          certificationStatus: 'PENDING_VERIFICATION',
          isActive: true,
        },
      });
    }

    console.log(`Migrated producer ${producer.id}: ${producer.fields.length} fields`);
  }
}
```

### 4.2 Existing Certifications Migration

**Map existing certifications to organic certificate eligibility**:

```typescript
// scripts/migrate-certifications.ts

async function migrateCertifications() {
  const certifications = await prisma.producerCertification.findMany({
    where: {
      type: {
        in: ['ORGANIC_USDA', 'ORGANIC_EU', 'SENASICA'],
      },
      isActive: true,
    },
    include: { producer: true },
  });

  for (const cert of certifications) {
    // Update organic field certification status
    await prisma.organicField.updateMany({
      where: { producerId: cert.producerId },
      data: {
        certificationStatus: 'CERTIFIED',
        certifiedStandards: [cert.type],
        organicSince: cert.issuedAt,
      },
    });
  }
}
```

### 4.3 Existing Batches → Inspection Data

**Note**: Existing batch events can inform organic certification but won't auto-convert to inspections.

```typescript
// Optional: Generate inspection records from existing batch events
async function generateInspectionsFromBatches() {
  const batches = await prisma.batch.findMany({
    include: {
      events: {
        where: {
          eventType: {
            in: ['FIELD_INSPECTION', 'PHOTO_CAPTURED', 'INPUT_APPLIED'],
          },
        },
      },
    },
  });

  // Transform batch events to inspection format
  // This is optional and should be reviewed manually
}
```

---

## 5. BACKWARD COMPATIBILITY

### 5.1 API Compatibility Matrix

| Existing Endpoint | Action | Notes |
|-------------------|--------|-------|
| `POST /api/v1/auth/*` | Keep | No changes |
| `GET /api/v1/producers/*` | Keep | Add optional `exportCompanyId` filter |
| `POST /api/v1/batches/*` | Keep | Continue working for non-organic flows |
| `GET /api/v1/batches/:id/stages` | Keep | Still functional |
| `POST /api/v1/certificates/*` | Keep | Existing QualityCertificate still works |
| `GET /api/v1/verify/*` | Keep | Add new organic verification routes |
| `POST /api/v1/payments/*` | Keep | Used for export company billing |
| `GET /api/v1/credit/*` | Disable | Feature flag off |
| `POST /api/v1/advances/*` | Disable | Feature flag off |

### 5.2 Database Compatibility

All migrations are **additive only**:
- No column drops
- No table renames
- No destructive changes
- Nullable foreign keys for new relationships

### 5.3 Feature Flags

```typescript
// apps/api/src/config/features.ts

export const FEATURES = {
  // Organic certification (new)
  ORGANIC_CERTIFICATION: process.env.FEATURE_ORGANIC_CERTIFICATION === 'true',

  // Existing features to keep
  BATCH_TRACEABILITY: true,
  BLOCKCHAIN_ANCHORING: true,
  PUBLIC_VERIFICATION: true,

  // Features to disable for MVP
  CASH_FLOW_BRIDGE: process.env.FEATURE_CASH_FLOW_BRIDGE === 'true',
  WHATSAPP_BOT: process.env.FEATURE_WHATSAPP_BOT === 'true',
  CREDIT_SCORING: false,
  LIQUIDITY_POOLS: false,
  REFERRALS: false,
};
```

---

## 6. DEPLOYMENT STRATEGY

### 6.1 Pre-Deployment Checklist

- [ ] Backup production database
- [ ] Run migrations on staging
- [ ] Test all existing endpoints still work
- [ ] Test new organic certification endpoints
- [ ] Verify blockchain integration
- [ ] Test PDF generation
- [ ] Verify IPFS uploads

### 6.2 Deployment Steps

```bash
# 1. Deploy database migrations first
npx prisma migrate deploy

# 2. Deploy new code with feature flag OFF
FEATURE_ORGANIC_CERTIFICATION=false

# 3. Run data migration scripts
npm run migrate:organic-fields

# 4. Enable feature flag
FEATURE_ORGANIC_CERTIFICATION=true

# 5. Monitor logs and metrics
```

### 6.3 Rollback Plan

```bash
# If issues detected:

# 1. Disable feature flag immediately
FEATURE_ORGANIC_CERTIFICATION=false

# 2. New endpoints will return 404
# 3. Existing functionality continues working
# 4. Investigate and fix issues
# 5. Re-enable when ready
```

---

## 7. COMMUNICATION PLAN

### 7.1 For Existing Users (if any)

**Email Template**:
```
Subject: AgroBridge Platform Update - Exciting New Features!

Dear [Farmer/Producer],

We're excited to announce a major platform update that will help you
prove your organic certification to export companies and international buyers.

What's New:
- Export company integration
- Organic field inspection tracking
- Blockchain-verified organic certificates
- QR verification for importers

What This Means for You:
- Your existing account and data are preserved
- New features are optional
- If your export company enrolls, you'll receive an invitation

Questions? Contact support@agrobridge.io

Best regards,
The AgroBridge Team
```

### 7.2 For Export Companies (New Customers)

**Sales Deck Updates**:
- Focus on organic certification value proposition
- Highlight blockchain verification
- Emphasize fraud prevention
- Show ROI calculations

---

## 8. SUCCESS METRICS

### 8.1 Migration Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Migration errors | 0 | Error logs |
| Existing endpoint uptime | 100% | Health checks |
| Data integrity | 100% | Validation queries |
| Performance degradation | < 5% | Response times |

### 8.2 Post-Migration Monitoring

```sql
-- Check migration integrity
SELECT
  (SELECT COUNT(*) FROM producers) as producers_count,
  (SELECT COUNT(*) FROM organic_fields) as organic_fields_count,
  (SELECT COUNT(*) FROM export_companies) as export_companies_count,
  (SELECT COUNT(*) FROM organic_certificates) as certificates_count;

-- Check for orphaned records
SELECT * FROM organic_fields
WHERE producer_id NOT IN (SELECT id FROM producers);
```

---

*Migration plan created by Claude (Principal Backend Architect) on 2025-12-24*
