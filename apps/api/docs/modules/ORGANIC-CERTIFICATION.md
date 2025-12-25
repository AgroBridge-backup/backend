# Organic Certification Module

Core domain service for organic certificate generation and management. Revenue-critical: $5-20/certificate + SaaS subscription.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Service** | `OrganicCertificateService` |
| **Location** | `src/domain/services/OrganicCertificateService.ts` |
| **Routes** | `src/presentation/routes/organic-certificates.routes.ts` |
| **Repository** | `src/infrastructure/database/prisma/repositories/PrismaOrganicCertificateRepository.ts` |
| **Entity** | `src/domain/entities/OrganicCertificate.ts` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Organic Certificate Flow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │  Farmer  │───▶│  Inspection  │───▶│  Certificate        │   │
│  │  Fields  │    │  Data        │    │  Generation         │   │
│  └──────────┘    └──────────────┘    └──────────┬──────────┘   │
│                                                  │               │
│                  ┌───────────────────────────────┼──────────┐   │
│                  │                               ▼          │   │
│                  │  ┌───────────┐  ┌───────────┐  ┌───────┐│   │
│                  │  │ PDF Gen   │  │ Blockchain│  │ IPFS  ││   │
│                  │  │ (QR Code) │  │ Anchoring │  │ Upload││   │
│                  │  └───────────┘  └───────────┘  └───────┘│   │
│                  └──────────────────────────────────────────┘   │
│                                      │                          │
│                                      ▼                          │
│                        ┌─────────────────────────┐              │
│                        │   PENDING_REVIEW        │              │
│                        │   (Export Co. Admin)    │              │
│                        └────────────┬────────────┘              │
│                                     │                           │
│                    ┌────────────────┼────────────────┐          │
│                    ▼                ▼                ▼          │
│              ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│              │ APPROVED │    │ REJECTED │    │ REVOKED  │       │
│              └──────────┘    └──────────┘    └──────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Certificate Status Lifecycle

| Status | Description | Next States |
|--------|-------------|-------------|
| `PROCESSING` | Generation in progress | `PENDING_REVIEW`, `BLOCKCHAIN_FAILED` |
| `PENDING_REVIEW` | Awaiting export company approval | `APPROVED`, `REJECTED` |
| `APPROVED` | Certificate is valid | `REVOKED` |
| `REJECTED` | Export company rejected | Terminal |
| `REVOKED` | Certificate invalidated (fraud) | Terminal |
| `BLOCKCHAIN_FAILED` | Blockchain anchoring failed | Retry possible |

### Certificate Requirements

```typescript
const CERTIFICATE_REQUIREMENTS = {
  minInspections: 3,           // Minimum verified inspections
  minPhotos: 10,               // Minimum geo-tagged photos
  minOrganicInputs: 2,         // Minimum organic input records
  inspectionWindowDays: 90,    // Inspections must be within 90 days
  certificateValidityDays: 365 // Certificate valid for 1 year
};
```

### Certificate Number Format

```
AGB-MX-2024-000001
│   │   │    └─ 6-digit sequence (auto-generated)
│   │   └─ Year
│   └─ Country code
└─ AgroBridge prefix
```

---

## API Endpoints

### Generate Certificate

```http
POST /api/v1/organic-certificates
Authorization: Bearer <token>
Content-Type: application/json

{
  "fieldIds": ["field-uuid-1", "field-uuid-2"],
  "cropType": "AVOCADO",
  "certificationStandard": "USDA_ORGANIC",
  "harvestDate": "2024-11-15"
}
```

**Response (201 Created):**
```json
{
  "id": "cert-uuid",
  "certificateNumber": "AGB-MX-2024-000001",
  "status": "PENDING_REVIEW",
  "validFrom": "2024-12-25T00:00:00Z",
  "validTo": "2025-12-25T00:00:00Z",
  "blockchainTxHash": "0x...",
  "pdfUrl": "https://s3.../certificates/AGB-MX-2024-000001.pdf"
}
```

### Get Certificate

```http
GET /api/v1/organic-certificates/:id
Authorization: Bearer <token>
```

### List Certificates

```http
GET /api/v1/organic-certificates?status=APPROVED&limit=50&offset=0
Authorization: Bearer <token>
```

### Approve Certificate (Admin)

```http
POST /api/v1/organic-certificates/:id/approve
Authorization: Bearer <admin-token>
```

### Reject Certificate (Admin)

```http
POST /api/v1/organic-certificates/:id/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "Insufficient photo evidence for field boundary verification"
}
```

### Verify Certificate (Public)

```http
GET /api/v1/public/verify/certificate/:certificateNumber
```

**Response:**
```json
{
  "valid": true,
  "certificateNumber": "AGB-MX-2024-000001",
  "status": "APPROVED",
  "farmInfo": {
    "farmerName": "Rancho El Sol",
    "location": "Uruapan, Michoacan",
    "totalHectares": 15.5,
    "cropType": "Avocado"
  },
  "certification": {
    "standard": "USDA Organic",
    "issuedDate": "2024-12-25T00:00:00Z",
    "expiryDate": "2025-12-25T00:00:00Z"
  },
  "blockchain": {
    "network": "POLYGON",
    "txHash": "0x...",
    "verified": true,
    "explorerUrl": "https://polygonscan.com/tx/0x..."
  },
  "ipfs": {
    "cid": "Qm...",
    "gatewayUrl": "https://gateway.pinata.cloud/ipfs/Qm..."
  }
}
```

---

## Business Logic

### Certificate Generation Steps

```typescript
// Simplified flow from OrganicCertificateService.generateCertificate()

1. Validate farmer exists and belongs to export company
2. Verify all fields belong to farmer
3. Check no pending certificates for these fields
4. Aggregate field inspection data (last 90 days)
5. Validate inspection requirements:
   - >= 3 verified inspections
   - >= 10 geo-tagged photos
   - >= 2 organic input records
6. Generate unique certificate number
7. Compute content hash (SHA-256)
8. Create certificate record (PROCESSING)
9. Generate PDF with QR code
10. Anchor to blockchain (with retry)
11. Upload metadata to IPFS (async, non-blocking)
12. Update status to PENDING_REVIEW
```

### Validation Errors

| Error Code | Cause | Resolution |
|------------|-------|------------|
| `INSUFFICIENT_INSPECTIONS` | < 3 inspections in 90 days | Complete more field inspections |
| `INSUFFICIENT_PHOTOS` | < 10 geo-tagged photos | Upload more photos during inspections |
| `INSUFFICIENT_ORGANIC_INPUTS` | < 2 organic inputs recorded | Log organic inputs used |
| `PENDING_CERTIFICATE_EXISTS` | Already generating for fields | Wait for existing to complete |

---

## Database Schema

```prisma
model OrganicCertificate {
  id                    String                    @id @default(uuid())
  certificateNumber     String                    @unique
  farmerId              String
  farmer                Producer                  @relation(fields: [farmerId])
  exportCompanyId       String
  exportCompany         ExportCompany             @relation(fields: [exportCompanyId])
  fieldIds              String[]
  cropType              String
  harvestDate           DateTime?
  certificationStandard String
  validFrom             DateTime
  validTo               DateTime
  status                OrganicCertificateStatus

  // Blockchain
  blockchainTxHash      String?
  blockchainNetwork     String?
  blockchainTimestamp   DateTime?
  contentHash           String?

  // IPFS
  ipfsHash              String?

  // Documents
  pdfUrl                String?
  qrCodeUrl             String?
  payloadSnapshot       String?                   @db.Text

  // Review
  reviewedBy            String?
  reviewedAt            DateTime?
  rejectionReason       String?
  submittedAt           DateTime?

  // Audit
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  // Relations
  verificationLogs      CertificateVerification[]
}
```

---

## Dependencies

### Internal
- `FieldInspectionService` - Inspection data aggregation
- `OrganicFieldService` - Field boundary verification
- `BlockchainService` - On-chain anchoring
- `PdfGenerator` - Certificate PDF generation
- `IpfsService` - IPFS metadata upload
- `StorageService` - S3 PDF storage

### External
- **Polygon Blockchain** - Certificate anchoring
- **Pinata/IPFS** - Decentralized metadata storage
- **AWS S3** - PDF document storage

---

## Configuration

```bash
# Required environment variables
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/xxx
BLOCKCHAIN_PRIVATE_KEY=0x...
BLOCKCHAIN_CONTRACT_ADDRESS=0x...

PINATA_API_KEY=xxx
PINATA_SECRET_KEY=xxx

AWS_S3_BUCKET=agrobridge-certificates
```

---

## Performance

| Operation | Target Latency | Notes |
|-----------|----------------|-------|
| Generate certificate | < 30s | Blockchain adds 5-10s |
| PDF generation | < 5s | Puppeteer-based |
| IPFS upload | Async | Non-blocking |
| Verify certificate | < 500ms | Cached |

### Caching Strategy

- Certificate verification: 5-minute TTL
- Farmer profile: 10-minute TTL
- Field data: 15-minute TTL

---

## Error Handling

```typescript
// Custom error types
class InsufficientInspectionDataError extends Error {
  statusCode = 400;
  code = 'INSUFFICIENT_INSPECTION_DATA';
}

class CertificateNotFoundError extends Error {
  statusCode = 404;
  code = 'CERTIFICATE_NOT_FOUND';
}

class BlockchainAnchoringError extends Error {
  statusCode = 500;
  code = 'BLOCKCHAIN_ANCHORING_FAILED';
  retryable = true;
}
```

---

## Monitoring

### Key Metrics

- `certificate_generation_duration_seconds`
- `certificate_generation_errors_total`
- `certificate_blockchain_retries_total`
- `certificate_verifications_total`

### Alerts

- Blockchain anchoring failures > 5/hour
- PDF generation failures > 3/hour
- Certificate generation p95 > 45s

---

## Security Considerations

1. **Content Hash**: SHA-256 hash of certificate payload prevents tampering
2. **Blockchain Proof**: On-chain record provides immutable audit trail
3. **IPFS Backup**: Decentralized storage ensures data availability
4. **Access Control**: Only export company admins can approve/reject
5. **Revocation**: Immediate revocation capability for fraud detection

---

## Related Documentation

- [Field Inspections](./FIELD-INSPECTIONS.md)
- [Public Traceability](./PUBLIC-TRACEABILITY.md)
- [API Documentation](../API-ENDPOINTS.md#organic-certificates)
