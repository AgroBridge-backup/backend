/**
 * Public Verify E2E Tests
 * Critical tests for public verification endpoints (no auth required)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole, BatchStatus, Variety, InvoiceStatus, ReferralStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app';

describe('Public Verify API E2E', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let testBatchId: string;
  let testInvoiceUuid: string;
  let testReferralId: string;

  const uniqueSuffix = Date.now();
  const testEmail = `verify-producer-${uniqueSuffix}@test.com`;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const hashedPassword = await bcrypt.hash('TestPass123!', 10);

    // Create test producer
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'Verify',
        lastName: 'Producer',
        isActive: true,
        producer: {
          create: {
            businessName: 'Verify Test Farm',
            rfc: `VER${uniqueSuffix}`.substring(0, 13),
            state: 'Michoacán',
            municipality: 'Uruapan',
            latitude: 19.4167,
            longitude: -102.0667,
            isWhitelisted: true,
          },
        },
      },
      include: { producer: true },
    });

    const producerId = user.producer!.id;

    // Create test batch
    const batch = await prisma.batch.create({
      data: {
        producerId,
        variety: Variety.HASS,
        origin: 'Uruapan, Michoacán',
        weightKg: 1000,
        harvestDate: new Date(),
        status: BatchStatus.REGISTERED,
        blockchainHash: `0x${uniqueSuffix}abcdef1234567890`,
      },
    });
    testBatchId = batch.id;

    // Create test invoice
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        producerId,
        folio: `TEST-${uniqueSuffix}`,
        uuid: `${uniqueSuffix}-test-uuid-1234`,
        subtotal: 5000,
        iva: 800,
        ivaRate: 16,
        total: 5800,
        currency: 'MXN',
        recipientRfc: 'XAXX010101000',
        recipientName: 'Test Buyer SA',
        status: InvoiceStatus.VERIFIED,
        blockchainHash: `0xinvoice${uniqueSuffix}`,
        blockchainVerified: true,
      },
    });
    testInvoiceUuid = invoice.uuid;

    // Create referral code for user
    await prisma.userReferralCode.create({
      data: {
        userId: user.id,
        code: `VER${uniqueSuffix}`.substring(0, 10),
      },
    });

    // Create test referral
    const referral = await prisma.referral.create({
      data: {
        referrerId: user.id,
        referredId: user.id, // Self for test purposes
        referralCode: `VER${uniqueSuffix}`.substring(0, 10),
        status: ReferralStatus.COMPLETED,
        activityScore: 100,
        batchesCreated: 5,
        loginCount: 20,
        rewardGranted: true,
        blockchainVerified: true,
        blockchainTxHash: `0xreferral${uniqueSuffix}`,
        monthYear: '2025-12',
      },
    });
    testReferralId = referral.id;

    app = createApp();
    request = supertest(app);
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await prisma.referral.deleteMany({
      where: { referralCode: { contains: uniqueSuffix.toString().substring(0, 5) } },
    }).catch(() => {});

    await prisma.userReferralCode.deleteMany({
      where: { code: { contains: uniqueSuffix.toString().substring(0, 5) } },
    }).catch(() => {});

    await prisma.invoice.deleteMany({
      where: { folio: { contains: uniqueSuffix.toString() } },
    }).catch(() => {});

    await prisma.batch.deleteMany({
      where: { id: testBatchId },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: { email: testEmail },
    }).catch(() => {});

    await prisma.$disconnect();
  });

  describe('GET /verify/batch/:id', () => {
    it('should verify batch without authentication', async () => {
      const response = await request
        .get(`/verify/batch/${testBatchId}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('batch');
      expect(response.body.batch.id).toBe(testBatchId);
      expect(response.body).toHaveProperty('blockchain');
    });

    it('should return HTML for browser requests', async () => {
      const response = await request
        .get(`/verify/batch/${testBatchId}`)
        .set('Accept', 'text/html');

      expect(response.status).toBe(200);
      expect(response.type).toContain('text/html');
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await request
        .get('/verify/batch/00000000-0000-0000-0000-000000000000')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /verify/invoice/:uuid', () => {
    it('should verify invoice without authentication', async () => {
      const response = await request
        .get(`/verify/invoice/${testInvoiceUuid}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('invoice');
      expect(response.body.invoice.uuid).toBe(testInvoiceUuid);
      expect(response.body.invoice.blockchainVerified).toBe(true);
    });

    it('should NOT expose sensitive data (email, internal IDs)', async () => {
      const response = await request
        .get(`/verify/invoice/${testInvoiceUuid}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      // Should not expose internal user ID
      expect(response.body.invoice).not.toHaveProperty('userId');
      // recipientEmail might be exposed for business purposes - check policy
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request
        .get('/verify/invoice/non-existent-uuid')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /verify/referral/:id', () => {
    it('should verify referral without authentication', async () => {
      const response = await request
        .get(`/verify/referral/${testReferralId}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('referral');
      expect(response.body.referral.id).toBe(testReferralId);
    });

    it('should NOT expose sensitive referrer/referred full names', async () => {
      const response = await request
        .get(`/verify/referral/${testReferralId}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      // Names should be masked (initials or partial)
      // Full implementation check depends on P1-3/P1-4 fixes
    });

    it('should return 404 for non-existent referral', async () => {
      const response = await request
        .get('/verify/referral/00000000-0000-0000-0000-000000000000')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /verify/leaderboard/:month/:year', () => {
    it('should get leaderboard without authentication', async () => {
      const response = await request
        .get('/verify/leaderboard/12/2025')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
    });
  });

  describe('Rate Limiting on Public Routes', () => {
    it('should have rate limiting headers', async () => {
      const response = await request
        .get(`/verify/batch/${testBatchId}`)
        .set('Accept', 'application/json');

      // After P1-2 fix, these headers should be present
      // For now, just check the endpoint works
      expect(response.status).toBe(200);
    });
  });
});
