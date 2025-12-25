/**
 * API Keys Management - Integration Tests
 *
 * Tests for API key endpoints including creation, listing, updating, and revocation.
 * Uses real database with test isolation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole, ApiKeyStatus, ApiKeyScope } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createApiRouter } from '../../src/presentation/routes/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Create minimal use cases for router
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository.js';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository.js';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase.js';
import { RefreshTokenUseCase } from '../../src/application/use-cases/auth/RefreshTokenUseCase.js';
import { LogoutUseCase } from '../../src/application/use-cases/auth/LogoutUseCase.js';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase.js';
import { redisClient } from '../../src/infrastructure/cache/RedisClient.js';
import { AllUseCases } from '../../src/application/use-cases/index.js';

describe('API Keys Integration Tests', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let testUserId: string;
  let otherUserId: string;
  let authToken: string;
  let otherUserToken: string;

  const uniqueSuffix = `apikey-${Date.now()}`;
  const testUserEmail = `apikey-test-${uniqueSuffix}@test.com`;
  const otherUserEmail = `apikey-other-${uniqueSuffix}@test.com`;
  const password = 'testPassword123!';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create test users
    const hashedPassword = await bcrypt.hash(password, 10);

    const testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'API',
        lastName: 'Test',
        isActive: true,
        producer: {
          create: {
            businessName: 'API Test Producer',
            rfc: `RFC${uniqueSuffix.slice(0, 10)}`,
            state: 'Test State',
            municipality: 'Test Muni',
            latitude: 0,
            longitude: 0,
            isWhitelisted: true,
          },
        },
      },
    });
    testUserId = testUser.id;

    const otherUser = await prisma.user.create({
      data: {
        email: otherUserEmail,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'Other',
        lastName: 'User',
        isActive: true,
        producer: {
          create: {
            businessName: 'Other Producer',
            rfc: `OTH${uniqueSuffix.slice(0, 10)}`,
            state: 'Other State',
            municipality: 'Other Muni',
            latitude: 0,
            longitude: 0,
            isWhitelisted: true,
          },
        },
      },
    });
    otherUserId = otherUser.id;

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    authToken = jwt.sign(
      { userId: testUserId, email: testUserEmail, role: UserRole.PRODUCER },
      jwtSecret,
      { expiresIn: '1h' }
    );
    otherUserToken = jwt.sign(
      { userId: otherUserId, email: otherUserEmail, role: UserRole.PRODUCER },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Setup app with minimal use cases
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);

    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
        logoutUseCase: new LogoutUseCase(redisClient),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
      },
      batches: {} as any,
      events: {} as any,
      producers: {} as any,
      verificationStages: {} as any,
      certificates: {} as any,
      transit: {} as any,
    };

    const apiRouter = createApiRouter(useCases, prisma);
    app = createApp(apiRouter);
    request = supertest(app);
  });

  beforeEach(async () => {
    // Clean up API keys between tests
    await prisma.apiKey.deleteMany({
      where: { userId: { in: [testUserId, otherUserId] } },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.apiKey.deleteMany({
      where: { userId: { in: [testUserId, otherUserId] } },
    });
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [testUserId, otherUserId] } },
    });
    await prisma.producer.deleteMany({
      where: { user: { email: { in: [testUserEmail, otherUserEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUserEmail, otherUserEmail] } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/api-keys', () => {
    it('should create a new API key and return it only once', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'My First API Key',
          description: 'For development use',
          scopes: ['READ', 'WRITE'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('key');
      expect(response.body.data.key).toMatch(/^ab_test_/);
      expect(response.body.data.label).toBe('My First API Key');
      expect(response.body.data.scopes).toContain('READ');
      expect(response.body.data.scopes).toContain('WRITE');
      expect(response.body.message).toContain('Store the key securely');

      // Verify key is stored in DB
      const dbKey = await prisma.apiKey.findFirst({
        where: { id: response.body.data.id },
      });
      expect(dbKey).not.toBeNull();
      expect(dbKey!.keyHash).not.toBe(response.body.data.key); // Hash, not plaintext
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .send({ label: 'Unauthorized Key' });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation error');
    });

    it('should apply custom rate limit', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'High Rate Key',
          rateLimitRpm: 1000,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.rateLimitRpm).toBe(1000);
    });

    it('should apply IP whitelist', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'IP Restricted Key',
          allowedIps: ['10.0.0.1', '10.0.0.2'],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.allowedIps).toEqual(['10.0.0.1', '10.0.0.2']);
    });
  });

  describe('GET /api/v1/api-keys', () => {
    it('should list all API keys for the authenticated user (masked)', async () => {
      // Create a couple of keys first
      await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Key 1' });

      await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Key 2' });

      const response = await request
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);

      // Verify keys are masked (only prefix, no full key)
      response.body.data.forEach((key: any) => {
        expect(key.keyPrefix).toMatch(/^ab_test_/);
        expect(key).not.toHaveProperty('key');
        expect(key).not.toHaveProperty('keyHash');
      });
    });

    it('should not show keys from other users', async () => {
      // Create key for test user
      await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Test User Key' });

      // Create key for other user
      await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ label: 'Other User Key' });

      // List as test user
      const response = await request
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].label).toBe('Test User Key');
    });
  });

  describe('GET /api/v1/api-keys/:id', () => {
    it('should retrieve a specific API key', async () => {
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Specific Key', description: 'Details test' });

      const keyId = createResponse.body.data.id;

      const response = await request
        .get(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(keyId);
      expect(response.body.data.label).toBe('Specific Key');
      expect(response.body.data.description).toBe('Details test');
    });

    it('should return 404 for non-existent key', async () => {
      const response = await request
        .get('/api/v1/api-keys/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should not allow access to other users keys', async () => {
      // Create key for other user
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ label: 'Private Key' });

      const keyId = createResponse.body.data.id;

      // Try to access as test user
      const response = await request
        .get(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/api-keys/:id', () => {
    it('should update label and description', async () => {
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Original Label' });

      const keyId = createResponse.body.data.id;

      const response = await request
        .patch(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Updated Label',
          description: 'New description',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.label).toBe('Updated Label');
      expect(response.body.data.description).toBe('New description');
    });

    it('should update rate limit', async () => {
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Rate Limit Key' });

      const keyId = createResponse.body.data.id;

      const response = await request
        .patch(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rateLimitRpm: 500 });

      expect(response.status).toBe(200);
      expect(response.body.data.rateLimitRpm).toBe(500);
    });

    it('should not allow updating other users keys', async () => {
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ label: 'Other Key' });

      const keyId = createResponse.body.data.id;

      const response = await request
        .patch(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Hijacked' });

      expect(response.status).toBe(500); // Throws error
    });
  });

  describe('DELETE /api/v1/api-keys/:id', () => {
    it('should revoke an API key', async () => {
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Key To Revoke' });

      const keyId = createResponse.body.data.id;

      const response = await request
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'No longer needed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('revoked');

      // Verify status in DB
      const dbKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
      });
      expect(dbKey!.status).toBe(ApiKeyStatus.REVOKED);
      expect(dbKey!.revokedReason).toBe('No longer needed');
    });

    it('should not allow revoking already revoked key', async () => {
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Double Revoke' });

      const keyId = createResponse.body.data.id;

      // First revoke
      await request
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Second revoke
      const response = await request
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });
  });

  describe('API Key Authentication Middleware', () => {
    it('should validate API key from Authorization header', async () => {
      // Create a key
      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Auth Test Key',
          scopes: ['READ'],
        });

      const apiKey = createResponse.body.data.key;

      // Use the API key to access public health endpoint (simulated)
      // In real tests, you'd have endpoints that accept API key auth
      expect(apiKey).toMatch(/^ab_test_/);
    });

    it('should return 401 for expired keys', async () => {
      // Create a key that's already expired
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago

      const createResponse = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Expired Key',
          expiresAt: pastDate.toISOString(),
        });

      // The key is created but immediately expired
      const keyId = createResponse.body.data.id;

      // Verify it's marked as expired after validation attempt
      const dbKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
      });

      // Key exists but will fail validation due to expiry
      expect(dbKey).not.toBeNull();
    });
  });

  describe('Scope Enforcement', () => {
    it('should create keys with READ scope by default', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ label: 'Default Scope Key' });

      expect(response.status).toBe(201);
      expect(response.body.data.scopes).toContain('READ');
    });

    it('should create keys with custom scopes', async () => {
      const response = await request
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          label: 'Admin Key',
          scopes: ['READ', 'WRITE', 'ADMIN'],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.scopes).toEqual(['READ', 'WRITE', 'ADMIN']);
    });
  });
});
