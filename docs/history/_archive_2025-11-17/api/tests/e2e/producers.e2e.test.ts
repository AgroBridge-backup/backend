import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';

// Import all required components for DI
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../src/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '../../src/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';

// Stubs for Producer Use Cases
class MockListProducersUseCase { async execute() { return []; } }
class MockGetProducerByIdUseCase { async execute() { return { id: 'mock-producer-id', businessName: 'Mock Producer' }; } }
class MockWhitelistProducerUseCase { async execute() { return { id: 'mock-producer-id', isWhitelisted: true }; } }
class MockAddCertificationUseCase { async execute() { return { id: 'mock-cert-id' }; } }


describe('Producers API (E2E)', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let adminToken: string;
  let producerToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await redisClient.client.flushdb(); // Ensure Redis is clean

    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);

    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
        logoutUseCase: new LogoutUseCase(redisClient),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
      },
      batches: {} as any, // Stubs for batches
      events: {} as any, // Stubs for events
      producers: {
        listProducersUseCase: new MockListProducersUseCase() as any,
        getProducerByIdUseCase: new MockGetProducerByIdUseCase() as any,
        whitelistProducerUseCase: new MockWhitelistProducerUseCase() as any,
        addCertificationUseCase: new MockAddCertificationUseCase() as any,
      },
    };
    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    // Login as ADMIN
    const adminLoginRes = await request.post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'test123',
    });
    adminToken = adminLoginRes.body.accessToken;

    // Login as PRODUCER
    const producerLoginRes = await request.post('/api/v1/auth/login').send({
      email: 'producer@test.com',
      password: 'prodpass',
    });
    producerToken = producerLoginRes.body.accessToken;

    expect(adminToken).toBeDefined();
    expect(producerToken).toBeDefined();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  describe('GET /api/v1/producers', () => {
    it('should return 401 Unauthorized if no token is provided', async () => {
      const response = await request.get('/api/v1/producers');
      expect(response.status).toBe(401);
    });

    it('should return 401 Unauthorized if token is invalid', async () => {
      const response = await request
        .get('/api/v1/producers')
        .set('Authorization', 'Bearer invalidtoken');
      expect(response.status).toBe(401);
    });

    it('should return 403 Forbidden for a user with PRODUCER role', async () => {
      const response = await request
        .get('/api/v1/producers')
        .set('Authorization', `Bearer ${producerToken}`);
      expect(response.status).toBe(403);
    });

    it('should return 200 OK for a user with ADMIN role', async () => {
      const response = await request
        .get('/api/v1/producers')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
    });
  });
});