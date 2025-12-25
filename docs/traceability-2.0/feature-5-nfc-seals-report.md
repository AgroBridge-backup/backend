# Feature 5: Tamper-Evident NFC Seals - Implementation Report

## Summary
Implemented cryptographically-secured NFC seal management for agricultural produce containers, enabling tamper detection through signature verification, read counter monitoring, and physical damage reporting.

## Files Changed/Created

### Domain Layer
| File | Description |
|------|-------------|
| `src/domain/entities/NfcSeal.ts` | Domain entity with enums, crypto functions, validation |
| `src/domain/repositories/INfcSealRepository.ts` | Repository interface for seal and verification CRUD |
| `src/domain/services/NfcSealService.ts` | Core service for provisioning, attachment, verification |

### Infrastructure Layer
| File | Description |
|------|-------------|
| `src/infrastructure/database/prisma/repositories/PrismaNfcSealRepository.ts` | Prisma implementation |

### Application Layer (Use Cases)
| File | Description |
|------|-------------|
| `src/application/use-cases/nfc-seals/ProvisionNfcSealUseCase.ts` | Provision new NFC seal |
| `src/application/use-cases/nfc-seals/AttachNfcSealUseCase.ts` | Attach seal to batch |
| `src/application/use-cases/nfc-seals/VerifyNfcSealUseCase.ts` | Verify seal integrity |
| `src/application/use-cases/nfc-seals/index.ts` | Barrel export |

### Presentation Layer
| File | Description |
|------|-------------|
| `src/presentation/routes/nfc-seals.routes.ts` | REST API routes |
| `src/presentation/routes/index.ts` | Updated to mount NFC routes |

### Tests
| File | Description |
|------|-------------|
| `tests/unit/nfc-seals/NfcSeal.test.ts` | Unit tests for domain logic |

### Mobile (iOS)
| File | Description |
|------|-------------|
| `docs/mobile/NfcSealScreen.swift` | SwiftUI with CoreNFC integration |

### Mobile (Android)
| File | Description |
|------|-------------|
| `mobile/android/.../nfc/NfcSealScreen.kt` | Compose UI with NFC reader |
| `mobile/android/.../nfc/NfcSealViewModel.kt` | ViewModel with NFC handling |

## New API Endpoints

| Method | Endpoint | Description | Auth Roles |
|--------|----------|-------------|------------|
| `POST` | `/api/v1/nfc-seals` | Provision single seal | ADMIN |
| `POST` | `/api/v1/nfc-seals/batch` | Provision multiple seals | ADMIN |
| `GET` | `/api/v1/nfc-seals/available` | List unassigned seals | ADMIN, QA |
| `GET` | `/api/v1/nfc-seals/stats` | Seal statistics by status | ADMIN |
| `GET` | `/api/v1/nfc-seals/:sealId` | Get seal by ID | Any authenticated |
| `GET` | `/api/v1/nfc-seals/serial/:serialNumber` | Get seal by serial | Any authenticated |
| `POST` | `/api/v1/nfc-seals/:sealId/attach` | Attach seal to batch | ADMIN, QA, DRIVER |
| `POST` | `/api/v1/nfc-seals/verify` | Verify seal (main endpoint) | ADMIN, QA, DRIVER, EXPORTER |
| `POST` | `/api/v1/nfc-seals/:sealId/remove` | Remove seal at destination | ADMIN, QA, DRIVER |
| `GET` | `/api/v1/nfc-seals/:sealId/verifications` | Get verification history | Any authenticated |
| `POST` | `/api/v1/nfc-seals/:sealId/report-damage` | Report physical damage | ADMIN, QA, DRIVER |
| `GET` | `/api/v1/nfc-seals/:sealId/challenge` | Get current challenge | ADMIN |
| `GET` | `/api/v1/nfc-seals/batches/:batchId/nfc-seals` | Get batch seals | Any authenticated |
| `GET` | `/api/v1/nfc-seals/batches/:batchId/nfc-seals/integrity` | Get batch integrity summary | QA, CERTIFIER, ADMIN |

## Key Features

### Seal Statuses
| Status | Description |
|--------|-------------|
| PROVISIONED | Seal created, ready for assignment |
| ATTACHED | Seal attached to batch container |
| VERIFIED | Seal successfully verified |
| TAMPERED | Tampering detected |
| REMOVED | Legitimately removed at destination |
| EXPIRED | Past validity period |

### Tamper Indicators
| Indicator | Severity | Description |
|-----------|----------|-------------|
| NONE | - | No tampering detected |
| SIGNATURE_MISMATCH | Critical | Cryptographic signature invalid |
| COUNTER_ANOMALY | Critical | NFC read counter unexpected |
| PHYSICAL_DAMAGE | Critical | Physical damage reported |
| LOCATION_MISMATCH | Warning | Scanned outside expected route |
| TIMING_ANOMALY | Warning | Unusual time between scans |

### Cryptographic Security
- **Key Generation**: ECDSA secp256k1 keypairs per seal
- **Private Key Storage**: AES-256-GCM encrypted with master key
- **Challenge-Response**: New challenge generated after each verification
- **Signature Verification**: SHA256 signature of challenge

### Integrity Score Calculation
- Starts at 100%
- 0% for TAMPERED status
- 50% for EXPIRED status
- -20 points per failed verification
- -30 points for counter anomaly
- -50 points for critical tamper indicator
- -20 points for warning tamper indicator

## Manual Testing

### 1. Provision Seal
```bash
curl -X POST http://localhost:3000/api/v1/nfc-seals \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "04ABCDEF12345678",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

### 2. Attach Seal to Batch
```bash
curl -X POST http://localhost:3000/api/v1/nfc-seals/SEAL_ID/attach \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "batch-uuid",
    "location": "Warehouse A",
    "latitude": -33.4569,
    "longitude": -70.6483
  }'
```

### 3. Verify Seal
```bash
curl -X POST http://localhost:3000/api/v1/nfc-seals/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "04ABCDEF12345678",
    "signature": "hex-signature-from-nfc",
    "readCounter": 5,
    "location": "Checkpoint 1",
    "deviceInfo": "iPhone 15 Pro"
  }'
```

### 4. Get Batch Integrity Summary
```bash
curl http://localhost:3000/api/v1/nfc-seals/batches/batch-uuid/nfc-seals/integrity \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Report Physical Damage
```bash
curl -X POST http://localhost:3000/api/v1/nfc-seals/SEAL_ID/report-damage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Seal torn, visible damage to antenna"
  }'
```

## Database Schema (Prisma)
```prisma
model NfcSeal {
  id                  String              @id @default(uuid())
  serialNumber        String              @unique
  batchId             String?
  status              NfcSealStatus       @default(PROVISIONED)
  publicKey           String
  encryptedPrivateKey String
  challenge           String?
  expectedReadCount   Int                 @default(0)
  actualReadCount     Int                 @default(0)
  attachedAt          DateTime?
  attachedBy          String?
  attachedLocation    String?
  attachedLatitude    Decimal?
  attachedLongitude   Decimal?
  removedAt           DateTime?
  removedBy           String?
  removedLocation     String?
  tamperIndicator     TamperIndicator     @default(NONE)
  tamperDetails       String?
  expiresAt           DateTime?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  batch               Batch?              @relation(fields: [batchId], references: [id])
  verifications       NfcSealVerification[]
}

model NfcSealVerification {
  id                String          @id @default(uuid())
  sealId            String
  verifiedBy        String
  verifiedAt        DateTime        @default(now())
  latitude          Decimal?
  longitude         Decimal?
  location          String?
  readCounter       Int
  signatureProvided String
  signatureExpected String
  challengeUsed     String
  isValid           Boolean
  tamperIndicator   TamperIndicator @default(NONE)
  tamperDetails     String?
  deviceInfo        String?
  seal              NfcSeal         @relation(fields: [sealId], references: [id])
}

enum NfcSealStatus {
  PROVISIONED
  ATTACHED
  VERIFIED
  TAMPERED
  REMOVED
  EXPIRED
}

enum TamperIndicator {
  NONE
  SIGNATURE_MISMATCH
  COUNTER_ANOMALY
  PHYSICAL_DAMAGE
  LOCATION_MISMATCH
  TIMING_ANOMALY
}
```

## TODOs for Future Enhancement

1. **NFC Tag Programming**
   - Secure element provisioning workflow
   - NDEF message format specification
   - Factory programming integration

2. **Blockchain Anchoring**
   - Hash verification records on-chain
   - Immutable tamper evidence

3. **Geofencing Integration**
   - Route-based location validation
   - Automatic LOCATION_MISMATCH detection

4. **Push Notifications**
   - Real-time tamper alerts to stakeholders
   - Verification confirmations

5. **Bulk Operations**
   - Mass provisioning from CSV
   - Batch seal assignment workflow

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  iOS CoreNFC    │     │ Android NfcAdapter│    │   Admin Portal  │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   POST /nfc-seals/verify │
                    │                         │
                    │   {serialNumber,        │
                    │    signature,           │
                    │    readCounter}         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    NfcSealService       │
                    ├─────────────────────────┤
                    │ • decryptPrivateKey()   │
                    │ • signChallenge()       │
                    │ • verifySignature()     │
                    │ • detectCounterAnomaly()│
                    │ • calculateIntegrity()  │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼─────────┐  ┌────▼────┐  ┌─────────▼─────────┐
    │  NfcSeal Table    │  │  Redis  │  │  Verification     │
    │  (status, keys)   │  │ (cache) │  │  History Table    │
    └───────────────────┘  └─────────┘  └───────────────────┘
```

## Security Considerations

1. **Master Key Management**
   - Store in HSM or secure vault (AWS KMS, HashiCorp Vault)
   - Rotate periodically
   - Never expose in logs or responses

2. **Private Key Protection**
   - Encrypted at rest with AES-256-GCM
   - Only decrypted for signature generation
   - Memory cleared after use

3. **Challenge Uniqueness**
   - 256-bit random challenges
   - Single-use (rotated after each verification)
   - Prevents replay attacks

4. **Audit Trail**
   - All verifications logged with metadata
   - Immutable verification history
   - Device fingerprinting for forensics
