# Public Traceability Module

Consumer-facing traceability portal for QR code scanning. Designed for 5-second comprehension on mobile devices.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Service** | `PublicTraceabilityService` |
| **Location** | `src/domain/services/PublicTraceabilityService.ts` |
| **Routes** | `src/presentation/routes/public-verify.routes.ts` |
| **Entity** | `src/domain/entities/PublicTraceability.ts` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Public Traceability Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │ Consumer    │  Scans QR code on product packaging            │
│  │ (Mobile)    │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  verify.agrobridge.io/ABC123                            │    │
│  │  (Short URL with 6-char code)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Public Batch Traceability                   │    │
│  │                                                          │    │
│  │  ┌────────────────────────────────────────────────────┐ │    │
│  │  │           Above-the-Fold (5 seconds)               │ │    │
│  │  │  • Product info (variety, origin)                  │ │    │
│  │  │  • Farmer name & photo                             │ │    │
│  │  │  • Key facts (4 data points)                       │ │    │
│  │  │  • Verification badge (blockchain)                 │ │    │
│  │  └────────────────────────────────────────────────────┘ │    │
│  │                                                          │    │
│  │  ┌────────────────────────────────────────────────────┐ │    │
│  │  │           Below-the-Fold (Details)                 │ │    │
│  │  │  • Journey timeline                                │ │    │
│  │  │  • Transit tracking                                │ │    │
│  │  │  • Cold chain data                                 │ │    │
│  │  │  • NFC seal status                                 │ │    │
│  │  │  • Certificate details                             │ │    │
│  │  │  • Field health imagery                            │ │    │
│  │  └────────────────────────────────────────────────────┘ │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Short Code Generation

Every batch gets a unique 6-character short code:

```typescript
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
// Example: "ABC123", "XY7K2M"
```

### Key Facts (Above-the-Fold)

Four most important data points shown immediately:

```typescript
const keyFacts: KeyFact[] = [
  { icon: '📅', label: 'Harvested', value: 'Dec 15, 2024' },
  { icon: '🚚', label: 'Distance', value: '2,450 km' },
  { icon: '🌡️', label: 'Temp Range', value: '2.1–4.8°C' },
  { icon: '✅', label: 'Blockchain', value: 'Verified', highlight: true }
];
```

### Verification Badge Status

| Status | Label | Meaning |
|--------|-------|---------|
| `VERIFIED` | Fully Verified by AgroBridge | All stages approved + blockchain |
| `PARTIAL` | X/5 Stages Verified | Some stages complete |
| `PENDING` | Verification in Progress | Still processing |

---

## API Endpoints

### Generate Public Link

```http
POST /api/v1/public-links
Authorization: Bearer <token>
Content-Type: application/json

{
  "batchId": "batch-uuid"
}
```

**Response (201 Created):**
```json
{
  "link": {
    "id": "link-uuid",
    "shortCode": "ABC123",
    "batchId": "batch-uuid",
    "isActive": true,
    "viewCount": 0
  },
  "publicUrl": "https://verify.agrobridge.io/ABC123",
  "qrImageUrl": null,
  "isNew": true
}
```

### Get Batch Traceability (Public)

```http
GET /api/v1/public/trace/:shortCode
```

**Response:**
```json
{
  "shortCode": "ABC123",
  "product": {
    "name": "Hass Avocado",
    "variety": "HASS",
    "origin": "Uruapan, Michoacan",
    "originFlag": "🇲🇽",
    "harvestDate": "2024-12-15T00:00:00Z",
    "weightKg": 250,
    "destinationCountry": "USA"
  },
  "farmer": {
    "id": "farmer-uuid",
    "slug": "rancho-el-sol",
    "displayName": "Rancho El Sol",
    "photoUrl": "https://...",
    "region": "Uruapan, Michoacan"
  },
  "keyFacts": [
    { "icon": "📅", "label": "Harvested", "value": "Dec 15, 2024" },
    { "icon": "🚚", "label": "Distance", "value": "2,450 km" },
    { "icon": "🌡️", "label": "Temp Range", "value": "2.1–4.8°C" },
    { "icon": "✅", "label": "Blockchain", "value": "Verified", "highlight": true }
  ],
  "verificationBadge": {
    "status": "VERIFIED",
    "label": "Fully Verified by AgroBridge",
    "blockchainHash": "0x...",
    "blockchainUrl": "https://polygonscan.com/tx/0x..."
  },
  "journey": [
    { "name": "Harvest", "status": "COMPLETED", "date": "2024-12-15T08:00:00Z", "icon": "🌱" },
    { "name": "Packing", "status": "COMPLETED", "date": "2024-12-15T14:00:00Z", "icon": "📦" },
    { "name": "Cold Chain", "status": "COMPLETED", "date": "2024-12-16T06:00:00Z", "icon": "❄️" },
    { "name": "Export", "status": "CURRENT", "date": null, "icon": "✈️" },
    { "name": "Delivery", "status": "PENDING", "date": null, "icon": "🏪" }
  ],
  "transit": {
    "status": "IN_TRANSIT",
    "originName": "Uruapan, MX",
    "destinationName": "Los Angeles, CA",
    "progressPercent": 65,
    "estimatedArrival": "2024-12-20T18:00:00Z"
  },
  "coldChain": {
    "isCompliant": true,
    "minTemp": 2.1,
    "maxTemp": 4.8,
    "avgTemp": 3.2,
    "readingCount": 156,
    "outOfRangeCount": 0,
    "chartData": [...]
  },
  "sealStatus": {
    "status": "VERIFIED",
    "label": "Seal verified & intact",
    "lastVerified": "2024-12-18T12:00:00Z",
    "verificationCount": 3,
    "integrityScore": 100
  },
  "certificate": {
    "grade": "PREMIUM",
    "certifyingBody": "AgroBridge Certified",
    "validFrom": "2024-12-15T00:00:00Z",
    "validTo": "2025-12-15T00:00:00Z",
    "isValid": true,
    "blockchainHash": "0x..."
  },
  "shareInfo": {
    "title": "Hass Avocado from Rancho El Sol - Uruapan, Michoacan",
    "description": "Verified traceability: Harvest Dec 15, 2024, 250kg.",
    "url": "https://verify.agrobridge.io/ABC123"
  }
}
```

### Get Farmer Profile (Public)

```http
GET /api/v1/public/farmers/:idOrSlug
```

**Response:**
```json
{
  "id": "farmer-uuid",
  "slug": "rancho-el-sol",
  "displayName": "Rancho El Sol",
  "photoUrl": "https://...",
  "region": "Uruapan, Michoacan",
  "country": "Mexico",
  "countryFlag": "🇲🇽",
  "story": "Family farm since 1952...",
  "mainCrops": ["Avocado", "Berries"],
  "yearsOfExperience": 72,
  "certifications": [
    {
      "name": "USDA Organic",
      "issuedBy": "USDA",
      "validUntil": "2025-06-01T00:00:00Z"
    }
  ],
  "stats": {
    "totalLotsExported": 156,
    "blockchainVerifiedLots": 142,
    "averageHealthScore": 87,
    "countriesExportedTo": ["US", "CA", "EU"]
  },
  "field": {
    "name": "Block A - Hass",
    "areaHectares": 15.5,
    "currentCrop": "Avocado",
    "centerLatitude": 19.4326,
    "centerLongitude": -102.0587
  }
}
```

### Record Scan Event

```http
POST /api/v1/public/trace/:shortCode/scan
Content-Type: application/json

{
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://supermarket.com",
  "country": "US",
  "city": "Los Angeles"
}
```

### Get Scan Analytics

```http
GET /api/v1/batches/:batchId/scan-analytics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalScans": 1247,
  "uniqueDevices": 892,
  "byCountry": {
    "US": 756,
    "CA": 234,
    "MX": 157
  },
  "byDevice": {
    "MOBILE": 1089,
    "TABLET": 98,
    "DESKTOP": 60
  },
  "byDay": [
    { "date": "2024-12-20", "scans": 45 },
    { "date": "2024-12-21", "scans": 67 }
  ]
}
```

---

## Data Aggregation

### Journey Timeline

Stages are derived from `verificationStages` table:

```typescript
const stageOrder = ['HARVEST', 'PACKING', 'COLD_CHAIN', 'EXPORT', 'DELIVERY'];

for (const type of stageOrder) {
  const stage = stageMap.get(type);
  timeline.push({
    name: stageNames[type],
    status: stage?.status === 'APPROVED' ? 'COMPLETED' :
            stage?.status === 'PENDING' ? 'CURRENT' : 'PENDING',
    date: stage?.timestamp || null,
    icon: getStageIcon(type)
  });
}
```

### Cold Chain Summary

```typescript
const coldChain = {
  isCompliant: outOfRangeCount === 0,
  minTemp: Math.min(...temperatures),
  maxTemp: Math.max(...temperatures),
  avgTemp: average(temperatures),
  readingCount: readings.length,
  outOfRangeCount: readings.filter(r => r.isOutOfRange).length,
  thresholdMin: 0,
  thresholdMax: 8,
  chartData: readings.slice(0, 24).map(r => ({
    timestamp: r.timestamp,
    value: r.value
  }))
};
```

---

## Mobile Optimization

### Design Principles

1. **5-Second Rule**: Key info visible immediately
2. **Touch-Friendly**: Large tap targets (44px minimum)
3. **Fast Loading**: < 3s on 3G
4. **Offline-Capable**: Service worker caching

### Device Detection

```typescript
function detectDeviceType(userAgent?: string): DeviceType {
  if (!userAgent) return 'UNKNOWN';
  if (/mobile/i.test(userAgent)) return 'MOBILE';
  if (/tablet|ipad/i.test(userAgent)) return 'TABLET';
  return 'DESKTOP';
}
```

---

## SEO & Social Sharing

### Open Graph Meta Tags

```html
<meta property="og:title" content="Hass Avocado from Rancho El Sol" />
<meta property="og:description" content="Verified traceability..." />
<meta property="og:image" content="https://..." />
<meta property="og:url" content="https://verify.agrobridge.io/ABC123" />
```

### Twitter Cards

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Hass Avocado from Rancho El Sol" />
```

---

## Database Schema

```prisma
model PublicTraceabilityLink {
  id          String    @id @default(uuid())
  batchId     String
  batch       Batch     @relation(fields: [batchId])
  shortCode   String    @unique
  publicUrl   String
  qrImageUrl  String?
  isActive    Boolean   @default(true)
  viewCount   Int       @default(0)
  expiresAt   DateTime?

  scanEvents  QrScanEvent[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model QrScanEvent {
  id          String                 @id @default(uuid())
  linkId      String
  link        PublicTraceabilityLink @relation(fields: [linkId])
  shortCode   String
  timestamp   DateTime               @default(now())
  country     String?
  city        String?
  deviceType  String?
  browser     String?
  referrer    String?
  userAgent   String?
}
```

---

## Performance

| Metric | Target | Notes |
|--------|--------|-------|
| First Contentful Paint | < 1.5s | Critical for mobile |
| Largest Contentful Paint | < 2.5s | Key facts visible |
| Time to Interactive | < 3s | Scrolling enabled |
| API Response | < 500ms | With caching |

### Caching Strategy

- Link lookup: Redis with 1-hour TTL
- Batch data: 5-minute TTL
- Farmer profile: 10-minute TTL
- Scan analytics: 15-minute TTL

---

## Privacy Considerations

1. **Farmer Names**: Show business name only (no personal info)
2. **GPS Data**: Show region, not exact coordinates
3. **Scan Tracking**: Anonymous, no PII stored
4. **Actor Roles**: Show "Agronomist" not inspector names

---

## Related Documentation

- [Organic Certification](./ORGANIC-CERTIFICATION.md)
- [API Documentation](../API-ENDPOINTS.md#public-verification)
