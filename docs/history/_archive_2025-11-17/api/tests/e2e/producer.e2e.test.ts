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


describe('Producer API E2E', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let adminToken: string;

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

    // Login as admin to get an auth token for authenticated tests
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'test123' });
    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  it('GET /api/v1/producers should be protected', async () => {
    await request
      .get('/api/v1/producers')
      .expect(401);
  });
  
  it('GET /api/v1/producers should return a list of producers for admin', async () => {
    const response = await request
      .get('/api/v1/producers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    expect(response.body).toBeInstanceOf(Array);
  });

  // Add more tests as needed for producer functionality
});