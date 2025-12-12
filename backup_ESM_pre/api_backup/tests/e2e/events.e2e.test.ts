import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, EventType, Variety, BatchStatus } from '@prisma/client';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';

// Import REAL components for a true E2E test
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { PrismaEventRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaEventRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';
import { RegisterEventUseCase } from '../../src/application/use-cases/events/RegisterEventUseCase';

describe('Events API (E2E)', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let adminToken: string;
  let testBatchId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await redisClient.client.flushdb();

    // Create a batch to associate events with
    const producer = await prisma.producer.findFirst({ where: { user: { email: 'producer@test.com' } } });
    const batch = await prisma.batch.create({
      data: {
        producerId: producer!.id,
        variety: Variety.HASS,
        origin: 'E2E Test Origin',
        weightKg: 500,
        harvestDate: new Date(),
        blockchainHash: `0x${'b'.repeat(64)}`,
      }
    });
    testBatchId = batch.id;

    // Instantiate REAL repositories
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const eventRepository = new PrismaEventRepository(prisma);

    // Instantiate REAL use cases
    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
      } as any,
      events: {
        registerEventUseCase: new RegisterEventUseCase(eventRepository),
      } as any,
      batches: {} as any,
      producers: {} as any,
    };

    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    const adminLoginRes = await request.post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'test123',
    });
    adminToken = adminLoginRes.body.accessToken;
  });

  afterAll(async () => {
    if (testBatchId) {
      await prisma.traceabilityEvent.deleteMany({ where: { batchId: testBatchId } });
      await prisma.batch.delete({ where: { id: testBatchId } });
    }
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  it('POST /api/v1/events should register a new event for a batch', async () => {
    const response = await request
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        batchId: testBatchId,
        eventType: EventType.HARVEST,
        latitude: 19.41,
        longitude: -102.06,
        notes: 'Initial harvest event for E2E test.'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.eventType).toBe(EventType.HARVEST);
  });
});