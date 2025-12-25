# Export Company Dashboard Module

B2B admin portal for export companies managing farmer suppliers. Comprehensive dashboard analytics, certificate review, farmer management, and billing.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Service** | `ExportCompanyDashboardService` |
| **Location** | `src/domain/services/ExportCompanyDashboardService.ts` |
| **Routes** | `src/presentation/routes/export-company-dashboard.routes.ts` |
| **Primary Customer** | Export companies (B2B) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│               Export Company Dashboard                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Dashboard Stats                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │ Farmers │ │ Certs   │ │ Fields  │ │ Billing │        │  │
│  │  │ 45 total│ │ 23 pend │ │ 892 ha  │ │ $1,234  │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐  ┌───────────────────────────────┐   │
│  │   Farmer Management  │  │    Certificate Review         │   │
│  │  • List farmers      │  │  • Pending approvals          │   │
│  │  • Bulk invitations  │  │  • Approve/Reject             │   │
│  │  • View stats        │  │  • Analytics                  │   │
│  └──────────────────────┘  └───────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────┐  ┌───────────────────────────────┐   │
│  │   Billing & Usage    │  │    Company Settings           │   │
│  │  • Current usage     │  │  • Profile                    │   │
│  │  • Invoices          │  │  • Branding                   │   │
│  │  • Tier info         │  │  • Team members               │   │
│  └──────────────────────┘  └───────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Dashboard Statistics

The main dashboard provides real-time KPIs:

```typescript
interface DashboardStats {
  period: DateRange;
  farmers: {
    total: number;
    active: number;           // Active in last 30 days
    inactive: number;
    newThisMonth: number;
    pendingInvitations: number;
  };
  certificates: {
    total: number;
    pending: number;          // Awaiting review
    approved: number;
    rejected: number;
    revoked: number;
    generatedThisMonth: number;
    avgReviewTimeHours: number;
  };
  fields: {
    total: number;
    totalHectares: number;
    byCropType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  inspections: {
    thisMonth: number;
    avgPerFarmer: number;
    photosUploaded: number;
    organicInputsTracked: number;
  };
  billing: {
    tier: string;
    monthlyFee: number;
    certificatesIncluded: number;
    certificatesGenerated: number;
    overageCount: number;
    overageFees: number;
    projectedTotal: number;
  };
  topFarmers: FarmerSummary[];
  recentCertificates: CertificateSummary[];
}
```

### Subscription Tiers

| Tier | Monthly Fee | Farmers | Certs Included | Overage Fee |
|------|-------------|---------|----------------|-------------|
| STARTER | $199 | 25 | 50 | $5/cert |
| PROFESSIONAL | $499 | 100 | 200 | $4/cert |
| ENTERPRISE | $1,499 | Unlimited | Unlimited | N/A |

---

## API Endpoints

### Get Dashboard Stats

```http
GET /api/v1/export-company-dashboard/stats?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-12-31T23:59:59Z"
  },
  "farmers": {
    "total": 45,
    "active": 38,
    "inactive": 7,
    "newThisMonth": 3,
    "pendingInvitations": 5
  },
  "certificates": {
    "total": 156,
    "pending": 12,
    "approved": 140,
    "rejected": 4,
    "revoked": 0,
    "generatedThisMonth": 23,
    "avgReviewTimeHours": 4.2
  },
  "fields": {
    "total": 89,
    "totalHectares": 892.5,
    "byCropType": { "AVOCADO": 67, "BERRIES": 22 },
    "byStatus": { "CERTIFIED": 78, "PENDING": 11 }
  },
  "billing": {
    "tier": "PROFESSIONAL",
    "monthlyFee": 499,
    "certificatesIncluded": 200,
    "certificatesGenerated": 156,
    "overageCount": 0,
    "overageFees": 0,
    "projectedTotal": 499
  }
}
```

### Certificate Analytics

```http
GET /api/v1/export-company-dashboard/certificate-analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "certificatesByDate": [
    { "date": "2024-12-01", "count": 5, "approved": 4, "rejected": 1 },
    { "date": "2024-12-02", "count": 3, "approved": 3, "rejected": 0 }
  ],
  "byCropType": {
    "AVOCADO": { "count": 45, "approvalRate": 96, "avgReviewTimeHours": 3.5 },
    "BERRIES": { "count": 12, "approvalRate": 92, "avgReviewTimeHours": 4.1 }
  },
  "byStandard": {
    "USDA_ORGANIC": 42,
    "EU_ORGANIC": 15
  },
  "rejectionReasons": [
    { "reason": "Insufficient photos", "count": 3, "percentage": 75 },
    { "reason": "Missing inspection", "count": 1, "percentage": 25 }
  ],
  "reviewMetrics": {
    "avgTimeToApproveHours": 3.8,
    "avgTimeToRejectHours": 2.1,
    "pendingOver24h": 2,
    "pendingOver72h": 0
  }
}
```

### List Pending Certificates

```http
GET /api/v1/export-company-dashboard/pending-certificates?page=1&limit=20
Authorization: Bearer <admin-token>
```

### Review Certificate

```http
POST /api/v1/export-company-dashboard/certificates/:id/review
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "action": "approve"  // or "reject"
  "reason": "Rejection reason if applicable"
}
```

### Bulk Approve Certificates

```http
POST /api/v1/export-company-dashboard/certificates/bulk-approve
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "certificateIds": ["cert-1", "cert-2", "cert-3"]
}
```

**Response:**
```json
{
  "total": 3,
  "success": 3,
  "failed": 0,
  "errors": []
}
```

### List Company Farmers

```http
GET /api/v1/export-company-dashboard/farmers?search=garcia&status=ACTIVE&page=1&limit=20
Authorization: Bearer <admin-token>
```

### Bulk Invite Farmers

```http
POST /api/v1/export-company-dashboard/farmers/invite-bulk
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "farmers": [
    { "email": "farmer1@example.com", "name": "Juan Garcia" },
    { "email": "farmer2@example.com", "name": "Maria Lopez" }
  ]
}
```

**Response:**
```json
{
  "total": 2,
  "success": 2,
  "failed": 0,
  "errors": [],
  "invitations": [
    { "id": "inv-1", "email": "farmer1@example.com", "inviteToken": "abc123" },
    { "id": "inv-2", "email": "farmer2@example.com", "inviteToken": "def456" }
  ]
}
```

### Get Current Billing Usage

```http
GET /api/v1/export-company-dashboard/billing/usage
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "period": {
    "start": "2024-12-01T00:00:00Z",
    "end": "2024-12-31T23:59:59Z"
  },
  "tier": "PROFESSIONAL",
  "baseFee": 499,
  "certificatesIncluded": 200,
  "certificatesGenerated": 156,
  "overages": 0,
  "overageFee": 4,
  "overageFees": 0,
  "projectedTotal": 499,
  "daysRemaining": 6
}
```

### Generate Invoice

```http
POST /api/v1/export-company-dashboard/billing/generate-invoice
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "periodStart": "2024-11-01T00:00:00Z",
  "periodEnd": "2024-11-30T23:59:59Z"
}
```

### Update Company Profile

```http
PUT /api/v1/export-company-dashboard/settings/profile
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Aguacates de Michoacan S.A.",
  "phone": "+52 443 123 4567",
  "address": "Av. Principal 123, Uruapan, Michoacan",
  "contactName": "Carlos Rodriguez",
  "contactEmail": "carlos@aguacates.mx"
}
```

---

## Business Logic

### Certificate Review Workflow

```typescript
// From ExportCompanyDashboardService.reviewCertificate()

1. Verify certificate exists
2. Check certificate belongs to this company
3. Verify status is PENDING_REVIEW
4. Apply review decision:
   - APPROVE: Update status, set reviewer, log approval
   - REJECT: Update status, set reason, notify farmer
5. Log audit trail
6. Return updated certificate
```

### Billing Calculation

```typescript
// Monthly billing calculation

const baseFee = company.monthlyFee;
const certsIncluded = company.certsIncluded;
const certsGenerated = countCertificatesInPeriod();
const overages = Math.max(0, certsGenerated - certsIncluded);
const overageFees = overages * company.certificateFee;
const subtotal = baseFee + overageFees;
const tax = subtotal * 0.16;  // 16% IVA (Mexico)
const total = subtotal + tax;
```

### Farmer Limit Enforcement

```typescript
// Before bulk invite
if (currentFarmerCount + newFarmers.length > maxFarmers) {
  throw new FarmerLimitExceededError(maxFarmers, currentFarmerCount, newFarmers.length);
}
```

---

## Database Schema

Key tables used:

```prisma
model ExportCompany {
  id                String           @id @default(uuid())
  name              String
  country           String           @default("Mexico")
  phone             String?
  address           String?
  contactName       String?
  contactEmail      String?
  contactPhone      String?
  logoUrl           String?
  primaryColor      String?

  // Subscription
  tier              String           @default("STARTER")
  monthlyFee        Decimal          @default(199)
  certificateFee    Decimal          @default(5)
  farmersIncluded   Int              @default(25)
  certsIncluded     Int              @default(50)

  // Relations
  producers         Producer[]
  certificates      OrganicCertificate[]
  invitations       FarmerInvitation[]
  invoices          ExportCompanyInvoice[]

  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}

model ExportCompanyInvoice {
  id                String           @id @default(uuid())
  exportCompanyId   String
  exportCompany     ExportCompany    @relation(fields: [exportCompanyId])
  invoiceNumber     String           @unique
  periodStart       DateTime
  periodEnd         DateTime
  baseFee           Decimal
  farmerCount       Int
  certificateCount  Int
  overageCerts      Int
  overageFees       Decimal
  subtotal          Decimal
  tax               Decimal
  total             Decimal
  status            String           @default("DRAFT")
  dueDate           DateTime
  paidAt            DateTime?

  createdAt         DateTime         @default(now())
}
```

---

## Performance Optimizations

### Parallel Query Execution

```typescript
// Dashboard stats use parallel queries
const [
  farmerStats,
  certificateStats,
  fieldStats,
  inspectionStats,
  topFarmers,
  recentCertificates,
  pendingInvitations,
] = await Promise.all([
  this.getFarmerStats(companyId, range),
  this.getCertificateStats(companyId, range),
  this.getFieldStats(companyId),
  this.getInspectionStats(companyId, range),
  this.getTopFarmers(companyId, 5),
  this.getRecentCertificates(companyId, 10),
  this.prisma.farmerInvitation.count({ where: { exportCompanyId: companyId, status: 'PENDING' } }),
]);
```

### Caching Strategy

| Data | TTL | Invalidation |
|------|-----|--------------|
| Dashboard stats | 5 min | On certificate/farmer change |
| Farmer list | 10 min | On invitation accept |
| Invoice history | 1 hour | On new invoice |

---

## Error Handling

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `ExportCompanyNotFoundError` | 404 | Company ID not found |
| `FarmerLimitExceededError` | 400 | Tier farmer limit reached |
| `CertificateNotFoundError` | 404 | Certificate ID not found |
| `InvalidBillingPeriodError` | 400 | Period start >= period end |

---

## Security

1. **Company Isolation**: All queries filter by `exportCompanyId`
2. **Admin-Only Access**: Dashboard routes require admin role
3. **Certificate Ownership**: Can only review own company's certificates
4. **Audit Logging**: All review actions logged with timestamp and user

---

## Related Documentation

- [Organic Certification](./ORGANIC-CERTIFICATION.md)
- [Payment Processing](./PAYMENT-PROCESSING.md)
- [API Documentation](../API-ENDPOINTS.md#export-company-dashboard)
