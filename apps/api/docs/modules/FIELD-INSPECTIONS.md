# Field Inspections Module

Business logic for field inspection management with GPS verification, photo evidence, and organic input tracking.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Service** | `FieldInspectionService` |
| **Location** | `src/domain/services/FieldInspectionService.ts` |
| **Routes** | `src/presentation/routes/field-inspections.routes.ts` |
| **Repository** | `src/infrastructure/database/prisma/repositories/PrismaFieldInspectionRepository.ts` |
| **Entity** | `src/domain/entities/FieldInspection.ts` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Field Inspection Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                                │
│  │   Inspector  │                                                │
│  │  (Mobile App)│                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Create Inspection                        │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐   │   │
│  │  │ GPS Verify  │ │ Field Data  │ │ Weather/Temp     │   │   │
│  │  │ (Boundary)  │ │ (Notes)     │ │ (Conditions)     │   │   │
│  │  └─────────────┘ └─────────────┘ └──────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Photos   │  │   Organic    │  │   Field      │            │
│  │ (GPS-tagged)│  │   Inputs     │  │  Activities  │            │
│  └────────────┘  └──────────────┘  └──────────────┘            │
│                          │                                       │
│                          ▼                                       │
│              ┌─────────────────────┐                            │
│              │  Supervisor Review  │                            │
│              │  (Verify Inspection)│                            │
│              └─────────────────────┘                            │
│                          │                                       │
│                          ▼                                       │
│              ┌─────────────────────┐                            │
│              │  Certificate Ready  │                            │
│              │  (Aggregated Data)  │                            │
│              └─────────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Inspection Types

| Type | Description | Frequency |
|------|-------------|-----------|
| `ROUTINE` | Regular scheduled inspection | Monthly |
| `INITIAL` | First inspection of new field | Once |
| `FOLLOW_UP` | Follow-up after issues found | As needed |
| `CERTIFICATION` | Pre-certification inspection | Before cert |
| `AUDIT` | External audit inspection | Annually |

### GPS Verification

Inspections can verify the inspector is physically at the field:

```typescript
// GPS verification check
const gpsVerified = await fieldRepository.isPointWithinBoundary(
  fieldId,
  inspectorLat,
  inspectorLng
);
```

### Photo Evidence

Photos capture geo-tagged evidence:
- Location verified against field boundary
- Timestamp recorded
- Distance from field center calculated

---

## API Endpoints

### Create Inspection

```http
POST /api/v1/field-inspections
Authorization: Bearer <token>
Content-Type: application/json

{
  "fieldId": "field-uuid",
  "inspectorName": "Juan Garcia",
  "inspectorRole": "AGRONOMIST",
  "inspectionType": "ROUTINE",
  "inspectorLat": 19.4326,
  "inspectorLng": -99.1332,
  "gpsAccuracy": 5.0,
  "weatherCondition": "SUNNY",
  "temperature": 24,
  "notes": "Crops in excellent condition",
  "issues": null,
  "recommendations": "Continue current irrigation schedule"
}
```

**Response (201 Created):**
```json
{
  "inspection": {
    "id": "insp-uuid",
    "fieldId": "field-uuid",
    "inspectorName": "Juan Garcia",
    "inspectionDate": "2024-12-25T10:30:00Z",
    "inspectionType": "ROUTINE",
    "gpsVerified": true,
    "isVerified": false
  },
  "gpsVerified": true,
  "message": "Inspection created with verified GPS location"
}
```

### Add Photo to Inspection

```http
POST /api/v1/field-inspections/:id/photos
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageUrl": "https://s3.../inspection-photos/photo-1.jpg",
  "thumbnailUrl": "https://s3.../inspection-photos/photo-1-thumb.jpg",
  "latitude": 19.4326,
  "longitude": -99.1332,
  "altitude": 2250,
  "capturedAt": "2024-12-25T10:35:00Z",
  "caption": "Healthy avocado trees in Block A",
  "photoType": "CROP_CONDITION"
}
```

**Response:**
```json
{
  "photo": {
    "id": "photo-uuid",
    "inspectionId": "insp-uuid",
    "imageUrl": "...",
    "withinFieldBoundary": true
  },
  "withinBoundary": true,
  "distanceFromField": null
}
```

### Add Organic Input

```http
POST /api/v1/field-inspections/:id/organic-inputs
Authorization: Bearer <token>
Content-Type: application/json

{
  "productName": "Compost Plus",
  "brandName": "OrganicGrow",
  "manufacturer": "Green Inputs LLC",
  "inputType": "FERTILIZER",
  "isOmriListed": true,
  "isOrganicApproved": true,
  "certificationNumber": "OMRI-12345",
  "receiptUrl": "https://s3.../receipts/receipt-001.pdf",
  "receiptDate": "2024-12-01",
  "quantity": "500 kg",
  "supplier": "Distribuidora Agricola"
}
```

### Verify Inspection (Supervisor)

```http
POST /api/v1/field-inspections/:id/verify
Authorization: Bearer <token>

{
  "verifiedBy": "supervisor-user-id"
}
```

### List Field Inspections

```http
GET /api/v1/organic-fields/:fieldId/inspections?limit=50&fromDate=2024-01-01
Authorization: Bearer <token>
```

### Get Inspection Statistics

```http
GET /api/v1/organic-fields/:fieldId/inspection-stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 12,
  "verified": 10,
  "unverified": 2,
  "byType": {
    "ROUTINE": 9,
    "CERTIFICATION": 2,
    "FOLLOW_UP": 1
  },
  "lastInspectionDate": "2024-12-15T14:30:00Z"
}
```

---

## Business Logic

### Inspection Creation Flow

```typescript
// From FieldInspectionService.createInspection()

1. Verify field exists
2. Validate GPS coordinates (if provided)
   - Check if inspector location is within field boundary
   - Set gpsVerified flag accordingly
3. Create inspection record with:
   - Generated UUID
   - Inspector details
   - GPS data and accuracy
   - Weather conditions
   - Initial notes
4. Return inspection with GPS verification status
```

### Photo Boundary Verification

```typescript
// Photos are verified against field boundary
const withinBoundary = await fieldRepository.isPointWithinBoundary(
  inspection.fieldId,
  photo.latitude,
  photo.longitude
);

if (!withinBoundary) {
  // Calculate distance from field center
  const distance = haversineDistance(
    photo.latitude, photo.longitude,
    field.centerLat, field.centerLng
  );
  // Photo still saved, but flagged
}
```

### Inspection Verification Requirements

An inspection needs supervisor verification to count toward certification:

1. Completed by authorized inspector
2. GPS location verified within field boundary
3. At least 3 photos uploaded
4. No unresolved issues flagged

---

## Database Schema

```prisma
model FieldInspection {
  id              String              @id @default(uuid())
  fieldId         String
  field           OrganicField        @relation(fields: [fieldId])
  inspectorId     String?
  inspectorName   String
  inspectorRole   String?
  inspectionType  InspectionType      @default(ROUTINE)
  inspectionDate  DateTime            @default(now())
  duration        Int?                // minutes

  // GPS Verification
  inspectorLat    Float?
  inspectorLng    Float?
  gpsAccuracy     Float?
  gpsVerified     Boolean             @default(false)

  // Conditions
  weatherCondition String?
  temperature     Float?

  // Notes
  notes           String?             @db.Text
  issues          String?             @db.Text
  recommendations String?             @db.Text

  // Verification
  isVerified      Boolean             @default(false)
  verifiedBy      String?
  verifiedAt      DateTime?

  // Relations
  photos          InspectionPhoto[]
  organicInputs   OrganicInput[]
  activities      FieldActivity[]

  // Audit
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
}

model InspectionPhoto {
  id                  String           @id @default(uuid())
  inspectionId        String
  inspection          FieldInspection  @relation(fields: [inspectionId])
  imageUrl            String
  thumbnailUrl        String?
  latitude            Float?
  longitude           Float?
  altitude            Float?
  capturedAt          DateTime         @default(now())
  caption             String?
  photoType           String?
  withinFieldBoundary Boolean          @default(true)
  distanceFromField   Float?

  createdAt           DateTime         @default(now())
}

model OrganicInput {
  id                 String           @id @default(uuid())
  inspectionId       String
  inspection         FieldInspection  @relation(fields: [inspectionId])
  productName        String
  brandName          String?
  manufacturer       String?
  inputType          OrganicInputType
  isOmriListed       Boolean          @default(false)
  isOrganicApproved  Boolean          @default(false)
  certificationNumber String?
  receiptUrl         String?
  receiptDate        DateTime?
  quantity           String?
  supplier           String?
  ocrExtractedData   Json?
  ocrConfidence      Float?
  verificationStatus VerificationStatus @default(PENDING)
  verifiedBy         String?
  verifiedAt         DateTime?
  rejectionReason    String?

  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
}
```

---

## Dependencies

### Internal
- `OrganicFieldService` - Field boundary data
- `StorageService` - Photo uploads
- `OrganicCertificateService` - Data aggregation

### External
- **AWS S3** - Photo storage
- **GPS Services** - Location verification

---

## Configuration

```bash
# Optional configuration
MAX_PHOTO_SIZE_MB=10
MAX_PHOTOS_PER_INSPECTION=50
INSPECTION_REMINDER_DAYS=30  # Days before needing new inspection
```

---

## Performance

| Operation | Target Latency | Notes |
|-----------|----------------|-------|
| Create inspection | < 500ms | Includes GPS verification |
| Add photo | < 2s | After upload complete |
| List inspections | < 300ms | Paginated |
| Get statistics | < 200ms | Cached |

---

## Haversine Distance Calculation

Used for calculating distance between GPS coordinates:

```typescript
private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

---

## Error Handling

| Error | HTTP Status | Resolution |
|-------|-------------|------------|
| Field not found | 404 | Verify field ID exists |
| Inspection not found | 404 | Check inspection ID |
| Already verified | 400 | Inspection can only be verified once |
| GPS outside boundary | 200 | Returns gpsVerified: false |

---

## Security

1. **GPS Spoofing Protection**: Compare GPS accuracy with expected values
2. **Photo Metadata**: EXIF data validation for timestamp/location
3. **Role-Based Access**: Only supervisors can verify inspections
4. **Audit Trail**: All changes logged with user ID and timestamp

---

## Related Documentation

- [Organic Certification](./ORGANIC-CERTIFICATION.md)
- [API Documentation](../API-ENDPOINTS.md#field-inspections)
