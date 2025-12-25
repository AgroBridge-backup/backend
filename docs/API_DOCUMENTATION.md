# AGROBRIDGE ORGANIC CERTIFICATION API DOCUMENTATION

**Version**: 1.0.0
**Base URL**: `https://api.agrobridge.io/api/v1`
**Date**: 2025-12-24

---

## 1. AUTHENTICATION

All authenticated endpoints require a JWT token in the Authorization header.

```
Authorization: Bearer <access_token>
```

### 1.1 Login

**POST** `/auth/login`

```json
// Request
{
  "email": "farmer@example.com",
  "password": "securePassword123"
}

// Response 200
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 900,
    "user": {
      "id": "user_abc123",
      "email": "farmer@example.com",
      "role": "PRODUCER",
      "exportCompanyId": "exp_def456"
    }
  }
}
```

### 1.2 Farmer Enrollment (B2B2C)

**POST** `/farmers/enroll`

Farmer accepts export company invitation and creates account.

```json
// Request
{
  "inviteToken": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Miguel García",
  "email": "miguel@gmail.com",
  "password": "securePassword123",
  "phone": "+521234567890"
}

// Response 201
{
  "success": true,
  "data": {
    "user": {
      "id": "user_xyz789",
      "email": "miguel@gmail.com",
      "role": "PRODUCER"
    },
    "producer": {
      "id": "prod_abc123",
      "businessName": "Miguel García",
      "exportCompanyId": "exp_def456"
    },
    "exportCompany": {
      "id": "exp_def456",
      "name": "Frutas Finas de Tancítaro"
    },
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
  }
}

// Error 400 - Invalid/expired token
{
  "success": false,
  "error": "Invalid or expired invitation",
  "code": "INVALID_INVITATION"
}
```

---

## 2. EXPORT COMPANY MANAGEMENT

### 2.1 Register Export Company

**POST** `/export-companies/register`

```json
// Request
{
  "name": "Frutas Finas de Tancítaro",
  "legalName": "Frutas Finas SA de CV",
  "rfc": "FFT2101015M3",
  "email": "admin@frutasfinas.com",
  "contactName": "Carlos Rodríguez",
  "contactEmail": "carlos@frutasfinas.com",
  "tier": "PROFESSIONAL",
  "enabledStandards": ["ORGANIC_USDA", "SENASICA"]
}

// Response 201
{
  "success": true,
  "data": {
    "exportCompany": {
      "id": "exp_def456",
      "name": "Frutas Finas de Tancítaro",
      "status": "TRIAL",
      "tier": "PROFESSIONAL",
      "trialEndsAt": "2025-01-29T00:00:00Z",
      "monthlyFee": 1000.00,
      "farmersIncluded": 50,
      "certsIncluded": 200
    },
    "adminUser": {
      "id": "user_admin123",
      "email": "admin@frutasfinas.com",
      "role": "EXPORT_COMPANY_ADMIN"
    }
  }
}
```

### 2.2 Get Company Profile

**GET** `/export-companies/me`

**Auth**: EXPORT_COMPANY_ADMIN

```json
// Response 200
{
  "success": true,
  "data": {
    "company": {
      "id": "exp_def456",
      "name": "Frutas Finas de Tancítaro",
      "tier": "PROFESSIONAL",
      "status": "ACTIVE",
      "enabledStandards": ["ORGANIC_USDA", "SENASICA"],
      "farmersIncluded": 50,
      "certsIncluded": 200
    },
    "usage": {
      "farmers": 32,
      "certificatesThisMonth": 45
    },
    "subscription": {
      "tier": "PROFESSIONAL",
      "status": "ACTIVE",
      "nextBillingDate": "2025-02-01"
    }
  }
}
```

### 2.3 Invite Farmers (Bulk)

**POST** `/export-companies/me/farmers/invite`

**Auth**: EXPORT_COMPANY_ADMIN

```json
// Request
{
  "invitations": [
    { "email": "farmer1@gmail.com", "name": "Juan Pérez" },
    { "email": "farmer2@gmail.com", "phone": "+521234567890" },
    { "email": "farmer3@gmail.com" }
  ]
}

// Response 200
{
  "success": true,
  "data": {
    "sent": 3,
    "failed": [],
    "invitations": [
      {
        "email": "farmer1@gmail.com",
        "inviteToken": "550e8400...",
        "status": "PENDING",
        "expiresAt": "2025-01-22T00:00:00Z"
      }
    ]
  }
}
```

### 2.4 List Enrolled Farmers

**GET** `/export-companies/me/farmers`

**Auth**: EXPORT_COMPANY_ADMIN

```
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20, max: 100)
- search: string (optional)
- status: "active" | "inactive" (optional)
```

```json
// Response 200
{
  "success": true,
  "data": {
    "farmers": [
      {
        "id": "prod_abc123",
        "name": "Miguel García",
        "email": "miguel@gmail.com",
        "fieldCount": 3,
        "certificateCount": 5,
        "lastActive": "2025-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 32,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

### 2.5 Dashboard Statistics

**GET** `/export-companies/me/dashboard`

**Auth**: EXPORT_COMPANY_ADMIN

```json
// Response 200
{
  "success": true,
  "data": {
    "period": "2025-01",
    "farmers": {
      "total": 127,
      "active": 98,
      "inactive": 29,
      "newThisMonth": 12
    },
    "certificates": {
      "total": 456,
      "pending": 23,
      "approved": 401,
      "rejected": 15,
      "revoked": 2,
      "thisMonth": 67
    },
    "fields": {
      "total": 312,
      "totalHectares": 8450,
      "byCrop": {
        "AVOCADO": 234,
        "BLUEBERRY": 45,
        "RASPBERRY": 23,
        "STRAWBERRY": 10
      }
    },
    "inspections": {
      "thisMonth": 342,
      "avgPerFarmer": 3.5,
      "photosUploaded": 4872
    },
    "billing": {
      "currentMonthFee": 1500.00,
      "certificateFees": 670.00,
      "totalDue": 2170.00,
      "overageCerts": 67
    }
  }
}
```

---

## 3. ORGANIC FIELDS

### 3.1 List Farmer's Fields

**GET** `/farmers/me/organic-fields`

**Auth**: PRODUCER

```json
// Response 200
{
  "success": true,
  "data": {
    "fields": [
      {
        "id": "field_abc123",
        "name": "Parcela Norte",
        "cropType": "AVOCADO",
        "variety": "HASS",
        "areaHectares": 25.5,
        "certificationStatus": "CERTIFIED",
        "certifiedStandards": ["ORGANIC_USDA"],
        "organicSince": "2020-01-15",
        "lastInspection": "2025-01-10"
      }
    ]
  }
}
```

### 3.2 Create Organic Field

**POST** `/farmers/me/organic-fields`

**Auth**: PRODUCER

```json
// Request
{
  "name": "Parcela Sur",
  "cropType": "AVOCADO",
  "variety": "HASS",
  "areaHectares": 15.25,
  "boundaryGeoJson": {
    "type": "Polygon",
    "coordinates": [[
      [-102.0431, 19.7523],
      [-102.0420, 19.7523],
      [-102.0420, 19.7510],
      [-102.0431, 19.7510],
      [-102.0431, 19.7523]
    ]]
  },
  "organicSince": "2022-03-01",
  "waterSources": ["WELL", "RAIN"],
  "irrigationType": "DRIP"
}

// Response 201
{
  "success": true,
  "data": {
    "field": {
      "id": "field_def456",
      "name": "Parcela Sur",
      "cropType": "AVOCADO",
      "areaHectares": 15.25,
      "certificationStatus": "PENDING_VERIFICATION",
      "centerLat": 19.7516,
      "centerLng": -102.0425
    }
  }
}
```

---

## 4. FIELD INSPECTIONS

### 4.1 Create Inspection

**POST** `/farmers/me/organic-fields/:fieldId/inspections`

**Auth**: PRODUCER

```json
// Request
{
  "inspectionType": "ROUTINE",
  "inspectionDate": "2025-01-15T09:30:00Z",
  "inspectorLat": 19.7520,
  "inspectorLng": -102.0428,
  "notes": "Weekly field check before harvest",
  "weatherCondition": "SUNNY",
  "temperature": 22.5
}

// Response 201
{
  "success": true,
  "data": {
    "inspection": {
      "id": "insp_xyz789",
      "fieldId": "field_abc123",
      "inspectionType": "ROUTINE",
      "inspectionDate": "2025-01-15T09:30:00Z",
      "gpsVerified": true,
      "status": "IN_PROGRESS"
    }
  }
}
```

### 4.2 Upload Inspection Photo

**POST** `/inspections/:inspectionId/photos`

**Auth**: PRODUCER

**Content-Type**: `multipart/form-data`

```
Form Data:
- photo: File (JPEG/PNG, max 10MB)
- latitude: number (optional, from EXIF)
- longitude: number (optional, from EXIF)
- caption: string (optional)
- photoType: "CROP" | "INPUT" | "PRACTICE" | "ISSUE"
```

```json
// Response 201
{
  "success": true,
  "data": {
    "photo": {
      "id": "photo_abc123",
      "imageUrl": "https://s3.amazonaws.com/agrobridge/inspections/photo_abc123.jpg",
      "thumbnailUrl": "https://s3.amazonaws.com/agrobridge/inspections/photo_abc123_thumb.jpg",
      "capturedAt": "2025-01-15T09:32:15Z",
      "latitude": 19.7521,
      "longitude": -102.0429
    },
    "gpsVerification": {
      "withinField": true,
      "distance": null
    }
  }
}

// Response with GPS warning
{
  "success": true,
  "data": {
    "photo": { ... },
    "gpsVerification": {
      "withinField": false,
      "distance": 150.5
    }
  },
  "warnings": [
    "Photo GPS is 150m outside declared field boundary"
  ]
}
```

### 4.3 Add Organic Input

**POST** `/inspections/:inspectionId/inputs`

**Auth**: PRODUCER

```json
// Request
{
  "productName": "Neem Oil Organic Pesticide",
  "brandName": "Monterey",
  "inputType": "PESTICIDE",
  "isOmriListed": true,
  "receiptUrl": "https://s3.amazonaws.com/agrobridge/receipts/receipt_123.jpg",
  "receiptDate": "2025-01-10",
  "quantity": "5 liters",
  "supplier": "Agro Orgánico de Michoacán"
}

// Response 201
{
  "success": true,
  "data": {
    "input": {
      "id": "input_abc123",
      "productName": "Neem Oil Organic Pesticide",
      "inputType": "PESTICIDE",
      "isOmriListed": true,
      "verificationStatus": "PENDING"
    }
  }
}
```

### 4.4 Scan Receipt (OCR)

**POST** `/inspections/:inspectionId/inputs/scan-receipt`

**Auth**: PRODUCER

**Content-Type**: `multipart/form-data`

```
Form Data:
- receipt: File (JPEG/PNG/PDF, max 10MB)
```

```json
// Response 200
{
  "success": true,
  "data": {
    "extractedData": {
      "productName": "Neem Oil Organic Pesticide",
      "brandName": "Monterey",
      "date": "2025-01-10",
      "quantity": "5L",
      "supplier": "Agro Orgánico",
      "isOrganic": true,
      "confidence": 0.94
    },
    "receiptUrl": "https://s3.amazonaws.com/agrobridge/receipts/receipt_456.jpg"
  }
}
```

### 4.5 Add Field Activity

**POST** `/inspections/:inspectionId/activities`

**Auth**: PRODUCER

```json
// Request
{
  "activityType": "SPRAYING",
  "description": "Applied organic neem oil pesticide for pest control",
  "activityDate": "2025-01-15T10:00:00Z",
  "duration": 120,
  "areaCovered": 5.0,
  "workerCount": 3
}

// Response 201
{
  "success": true,
  "data": {
    "activity": {
      "id": "activity_abc123",
      "activityType": "SPRAYING",
      "activityDate": "2025-01-15T10:00:00Z"
    }
  }
}
```

---

## 5. ORGANIC CERTIFICATES

### 5.1 Request Certificate

**POST** `/farmers/me/certificates/request`

**Auth**: PRODUCER

```json
// Request
{
  "fieldIds": ["field_abc123", "field_def456"],
  "cropType": "AVOCADO",
  "variety": "HASS",
  "certificationStandard": "ORGANIC_USDA",
  "harvestDate": "2025-02-15",
  "estimatedWeight": 25000,
  "notes": "Pre-harvest certification for US export"
}

// Response 201
{
  "success": true,
  "data": {
    "certificate": {
      "id": "cert_xyz789",
      "certificateNumber": "AGB-MX-2025-001234",
      "status": "PENDING_REVIEW",
      "pdfUrl": "https://s3.amazonaws.com/agrobridge-certs/AGB-MX-2025-001234.pdf",
      "qrCodeUrl": "https://s3.amazonaws.com/agrobridge-qr/AGB-MX-2025-001234.png",
      "createdAt": "2025-01-15T10:30:00Z"
    },
    "eligibility": {
      "inspectionsRequired": 4,
      "inspectionsActual": 12,
      "photosCount": 156,
      "organicInputsVerified": 8,
      "gpsVerificationRate": 100
    },
    "message": "Certificate submitted for review. Estimated review time: 24-48 hours."
  }
}

// Error 400 - Insufficient inspections
{
  "success": false,
  "error": "Insufficient field inspections",
  "code": "INSUFFICIENT_INSPECTIONS",
  "details": {
    "required": 4,
    "actual": 2,
    "message": "Minimum 4 field inspections required in last 90 days"
  }
}
```

### 5.2 List Farmer's Certificates

**GET** `/farmers/me/certificates`

**Auth**: PRODUCER

```
Query Parameters:
- status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" (optional)
- page: number (default: 1)
- limit: number (default: 20)
```

```json
// Response 200
{
  "success": true,
  "data": {
    "certificates": [
      {
        "id": "cert_xyz789",
        "certificateNumber": "AGB-MX-2025-001234",
        "status": "APPROVED",
        "cropType": "AVOCADO",
        "certificationStandard": "ORGANIC_USDA",
        "validFrom": "2025-01-15",
        "validTo": "2026-01-15",
        "pdfUrl": "https://...",
        "viewCount": 47
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20
    }
  }
}
```

### 5.3 Approve Certificate (Export Company)

**POST** `/export-companies/me/certificates/:id/approve`

**Auth**: EXPORT_COMPANY_ADMIN

```json
// Response 200
{
  "success": true,
  "data": {
    "certificate": {
      "id": "cert_xyz789",
      "certificateNumber": "AGB-MX-2025-001234",
      "status": "APPROVED",
      "reviewedAt": "2025-01-16T14:30:00Z",
      "blockchainTxHash": "0x7f3a...8c2d",
      "ipfsHash": "QmX7Y8Z..."
    },
    "pdfUrl": "https://s3.amazonaws.com/agrobridge-certs/AGB-MX-2025-001234.pdf",
    "verificationUrl": "https://verify.agrobridge.io/AGB-MX-2025-001234"
  }
}
```

### 5.4 Reject Certificate (Export Company)

**POST** `/export-companies/me/certificates/:id/reject`

**Auth**: EXPORT_COMPANY_ADMIN

```json
// Request
{
  "reason": "Insufficient organic input documentation. Please upload purchase receipts for all pesticides used in January."
}

// Response 200
{
  "success": true,
  "data": {
    "certificate": {
      "id": "cert_xyz789",
      "status": "REJECTED",
      "rejectionReason": "Insufficient organic input documentation..."
    }
  }
}
```

---

## 6. PUBLIC VERIFICATION (No Auth)

### 6.1 Verify Organic Certificate

**GET** `/verify/organic/:certificateNumber`

**No Authentication Required**

```json
// Response 200 - Valid certificate
{
  "success": true,
  "data": {
    "valid": true,
    "certificate": {
      "certificateNumber": "AGB-MX-2025-001234",
      "status": "APPROVED",
      "farmInfo": {
        "name": "Miguel G.",
        "location": "Michoacán, Mexico",
        "cropType": "AVOCADO",
        "variety": "HASS",
        "hectares": 50
      },
      "certification": {
        "standard": "ORGANIC_USDA",
        "standardLogo": "https://agrobridge.io/logos/usda-organic.png",
        "harvestDate": "2025-02-15",
        "validFrom": "2025-01-15",
        "validTo": "2026-01-15"
      },
      "blockchain": {
        "network": "polygon",
        "txHash": "0x7f3a...8c2d",
        "explorerUrl": "https://polygonscan.com/tx/0x7f3a...8c2d",
        "timestamp": "2025-01-15T10:45:23Z"
      },
      "ipfs": {
        "cid": "QmX7Y8Z...",
        "gatewayUrl": "https://gateway.pinata.cloud/ipfs/QmX7Y8Z..."
      },
      "exportCompany": {
        "name": "Frutas Finas de Tancítaro",
        "country": "Mexico"
      },
      "inspectionSummary": {
        "totalInspections": 12,
        "photosCount": 156,
        "organicInputsVerified": 8,
        "lastInspectionDate": "2025-01-10"
      },
      "verificationStats": {
        "viewCount": 47,
        "lastViewedAt": "2025-01-20T14:23:10Z"
      }
    }
  }
}

// Response 200 - Invalid/expired certificate
{
  "success": true,
  "data": {
    "valid": false,
    "exists": true,
    "status": "EXPIRED",
    "certificate": {
      "certificateNumber": "AGB-MX-2024-000123",
      "validTo": "2025-01-01"
    },
    "message": "This certificate has expired"
  }
}

// Response 404 - Not found
{
  "success": false,
  "error": "Certificate not found",
  "code": "CERTIFICATE_NOT_FOUND"
}
```

### 6.2 Log Verification View

**POST** `/verify/organic/:certificateNumber/log`

**No Authentication Required**

```json
// Request (optional body)
{
  "verifierType": "IMPORTER",
  "referrer": "https://walmart.com/supplier-verify"
}

// Response 201
{
  "success": true,
  "message": "Verification logged"
}
```

---

## 7. ERROR CODES

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_INVITATION` | 400 | Invitation token invalid/expired |
| `INSUFFICIENT_INSPECTIONS` | 400 | Not enough inspections for certificate |
| `NO_ORGANIC_INPUTS` | 400 | No verified organic inputs |
| `GPS_VERIFICATION_FAILED` | 400 | Photos outside field boundary |
| `COMPANY_SUSPENDED` | 403 | Export company account suspended |
| `CERTIFICATE_NOT_FOUND` | 404 | Certificate doesn't exist |
| `BLOCKCHAIN_ERROR` | 500 | Blockchain transaction failed |
| `IPFS_ERROR` | 500 | IPFS upload failed |
| `RATE_LIMITED` | 429 | Too many requests |

---

## 8. RATE LIMITS

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| API (authenticated) | 100 requests | 1 minute |
| Public verification | 30 requests | 1 minute |
| File uploads | 50 requests | 1 hour |

---

## 9. WEBHOOKS (Future)

**Coming Soon**: Webhook notifications for certificate status changes.

```json
// Certificate Approved Webhook
{
  "event": "certificate.approved",
  "timestamp": "2025-01-16T14:30:00Z",
  "data": {
    "certificateId": "cert_xyz789",
    "certificateNumber": "AGB-MX-2025-001234",
    "farmerId": "prod_abc123",
    "blockchainTxHash": "0x7f3a...8c2d"
  }
}
```

---

*API Documentation created by Claude (Principal Backend Architect) on 2025-12-24*
