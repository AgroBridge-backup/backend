/**
 * Traceability 2.0 - Multi-Stage Verification
 * E2E Tests for Verification Stages API
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { PrismaClient, UserRole, StageType, StageStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';

// Test utilities
const prisma = new PrismaClient();

// Generate test JWT
function generateTestToken(userId: string, role: UserRole, producerId?: string): string {
  const privateKey = process.env.JWT_PRIVATE_KEY || `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2mKqH...test-key-for-development...
-----END RSA PRIVATE KEY-----`;

  return jwt.sign(
    { sub: userId, role, email: `test-${userId}@test.com`, producerId },
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h', jwtid: `test-${Date.now()}` }
  );
}

describe('Verification Stages API E2E', () => {
  let app: ReturnType<typeof createApp>;
  let request: ReturnType<typeof supertest>;
  let testBatchId: string;
  let adminToken: string;
  let producerToken: string;
  let qaToken: string;
  let adminUserId: string;
  let producerUserId: string;
  let qaUserId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Create test users
    const hashedPassword = await bcrypt.hash('testPassword123!', 10);

    const adminUser = await prisma.user.create({
      data: {
        email: `admin-stages-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateTestToken(adminUser.id, UserRole.ADMIN);

    const producerUser = await prisma.user.create({
      data: {
        email: `producer-stages-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        isActive: true,
      },
    });
    producerUserId = producerUser.id;
    producerToken = generateTestToken(producerUser.id, UserRole.PRODUCER);

    const qaUser = await prisma.user.create({
      data: {
        email: `qa-stages-${Date.now()}@test.com`,
        passwordHash: hashedPassword,
        role: UserRole.QA,
        isActive: true,
      },
    });
    qaUserId = qaUser.id;
    qaToken = generateTestToken(qaUser.id, UserRole.QA);

    // Create test batch
    const batch = await prisma.batch.create({
      data: {
        code: `BATCH-STAGES-${Date.now()}`,
        description: 'Test batch for verification stages',
        status: 'PENDING',
      },
    });
    testBatchId = batch.id;

    app = createApp();
    request = supertest(app);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.verificationStage.deleteMany({
      where: { batchId: testBatchId },
    });
    await prisma.batch.deleteMany({
      where: { id: testBatchId },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUserId, producerUserId, qaUserId] },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean stages before each test
    await prisma.verificationStage.deleteMany({
      where: { batchId: testBatchId },
    });
  });

  describe('GET /api/v1/batches/:id/stages', () => {
    it('should return empty stages for a new batch', async () => {
      const response = await request
        .get(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stages).toEqual([]);
      expect(response.body.data.currentStage).toBeNull();
      expect(response.body.data.nextStage).toBe('HARVEST');
      expect(response.body.data.isComplete).toBe(false);
      expect(response.body.data.progress).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await request.get(`/api/v1/batches/${testBatchId}/stages`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/batches/:id/stages', () => {
    it('should create HARVEST stage as first stage', async () => {
      const response = await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          location: 'Field A, Michoacan',
          latitude: 19.7,
          longitude: -101.1,
          notes: 'Harvest completed successfully',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stage.stageType).toBe('HARVEST');
      expect(response.body.data.stage.status).toBe('PENDING');
      expect(response.body.data.stage.location).toBe('Field A, Michoacan');
      expect(response.body.data.isComplete).toBe(false);
    });

    it('should NOT allow creating PACKING before HARVEST is approved', async () => {
      // First create HARVEST
      await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({});

      // Try to create PACKING (should fail because HARVEST is not approved)
      const response = await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({ stageType: 'PACKING' });

      expect(response.status).toBe(400);
    });

    it('should allow creating next stage after approval', async () => {
      // Create HARVEST
      const harvestRes = await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({});

      const harvestStageId = harvestRes.body.data.stage.id;

      // Approve HARVEST
      await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${harvestStageId}`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ status: 'APPROVED' });

      // Now create PACKING
      const packingRes = await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({});

      expect(packingRes.status).toBe(201);
      expect(packingRes.body.data.stage.stageType).toBe('PACKING');
    });

    it('should NOT allow USER role to create stages', async () => {
      const userToken = generateTestToken('user-id', UserRole.USER);

      const response = await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/batches/:id/stages/:stageId', () => {
    let stageId: string;

    beforeEach(async () => {
      // Create a HARVEST stage for testing
      const res = await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({});
      stageId = res.body.data.stage.id;
    });

    it('should allow QA to approve a stage', async () => {
      const response = await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${stageId}`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(200);
      expect(response.body.data.stage.status).toBe('APPROVED');
    });

    it('should allow updating notes', async () => {
      const response = await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${stageId}`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({ notes: 'Updated notes for harvest' });

      expect(response.status).toBe(200);
      expect(response.body.data.stage.notes).toBe('Updated notes for harvest');
    });

    it('should NOT allow invalid status transition', async () => {
      // First approve the stage
      await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${stageId}`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ status: 'APPROVED' });

      // Try to transition from APPROVED to PENDING (invalid)
      const response = await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${stageId}`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ status: 'PENDING' });

      expect(response.status).toBe(400);
    });

    it('should allow REJECTED -> PENDING transition (retry)', async () => {
      // First reject the stage
      await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${stageId}`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ status: 'REJECTED' });

      // Now retry (PENDING)
      const response = await request
        .patch(`/api/v1/batches/${testBatchId}/stages/${stageId}`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ status: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body.data.stage.status).toBe('PENDING');
    });
  });

  describe('Stage Order Enforcement', () => {
    it('should enforce correct stage order through full workflow', async () => {
      const stages: string[] = [];

      // Create and approve all 5 stages in order
      for (const stageType of ['HARVEST', 'PACKING', 'COLD_CHAIN', 'EXPORT', 'DELIVERY']) {
        // Create stage
        const createRes = await request
          .post(`/api/v1/batches/${testBatchId}/stages`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(createRes.status).toBe(201);
        expect(createRes.body.data.stage.stageType).toBe(stageType);
        stages.push(createRes.body.data.stage.id);

        // Approve stage
        const approveRes = await request
          .patch(`/api/v1/batches/${testBatchId}/stages/${createRes.body.data.stage.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'APPROVED' });

        expect(approveRes.status).toBe(200);
      }

      // Verify all stages are complete
      const finalRes = await request
        .get(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(finalRes.body.data.stages.length).toBe(5);
      expect(finalRes.body.data.isComplete).toBe(true);
      expect(finalRes.body.data.progress).toBe(100);
      expect(finalRes.body.data.nextStage).toBeNull();
    });
  });

  describe('POST /api/v1/batches/:id/stages/finalize', () => {
    it('should finalize batch when all stages are approved', async () => {
      // Create and approve all stages
      for (let i = 0; i < 5; i++) {
        const createRes = await request
          .post(`/api/v1/batches/${testBatchId}/stages`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        await request
          .patch(`/api/v1/batches/${testBatchId}/stages/${createRes.body.data.stage.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'APPROVED' });
      }

      // Finalize
      const response = await request
        .post(`/api/v1/batches/${testBatchId}/stages/finalize`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hash).toBeDefined();
      expect(response.body.data.payload.stages.length).toBe(5);
    });

    it('should NOT allow finalization when stages are incomplete', async () => {
      // Create only HARVEST stage (not all 5)
      await request
        .post(`/api/v1/batches/${testBatchId}/stages`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({});

      const response = await request
        .post(`/api/v1/batches/${testBatchId}/stages/finalize`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });

    it('should NOT allow non-admin/certifier to finalize', async () => {
      const response = await request
        .post(`/api/v1/batches/${testBatchId}/stages/finalize`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(403);
    });
  });
});
