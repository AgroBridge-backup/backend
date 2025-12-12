import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';

// Import REAL components for a true E2E test
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { PrismaBatchRepository } from '../../src/core/batches/infrastructure/PrismaBatchRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';
import { CreateBatchUseCase } from '../../src/application/use-cases/batches/CreateBatchUseCase';
import { GetBatchByIdUseCase } from '../../src/application/use-cases/batches/GetBatchByIdUseCase';

describe('Batches API (E2E)', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let producerToken: string;
  let createdBatchId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await redisClient.client.flushdb();

    // Instantiate REAL repositories
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const batchRepository = new PrismaBatchRepository(prisma);

    // Instantiate REAL use cases
    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
      } as any,
      batches: {
        createBatchUseCase: new CreateBatchUseCase(batchRepository),
        getBatchByIdUseCase: new GetBatchByIdUseCase(batchRepository),
      } as any,
      events: {} as any,
      producers: {} as any,
    };

    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    // FIX: Login as a PRODUCER to get a valid token for this test suite
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: 'producer@test.com', password: 'prodpass' });
    producerToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Graceful cleanup
    if (createdBatchId) {
      try { await prisma.batch.delete({ where: { id: createdBatchId } }); } catch (e) {}
    }
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  it('POST /api/v1/batches should return 201 when creating a new batch with a producer token', async () => {
    const response = await request
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${producerToken}`) // Use the correct producer token
      .send({
        variety: 'HASS',
        origin: 'Uruapan, Michoacán',
        weightKg: 1200.75,
        harvestDate: new Date(),
        blockchainHash: `0x${'a'.repeat(64)}`
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    createdBatchId = response.body.id;
  });

  it('GET /api/v1/batches/:id should retrieve the created batch', async () => {
    expect(createdBatchId).toBeDefined(); 
    
    const response = await request
      .get(`/api/v1/batches/${createdBatchId}`)
      .set('Authorization', `Bearer ${producerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(createdBatchId);
  });
});
