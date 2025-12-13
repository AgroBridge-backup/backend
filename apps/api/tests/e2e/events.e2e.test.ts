import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, EventType } from '@prisma/client';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';
import { runSeed } from '../../src/infrastructure/database/seed.js';

// Import REAL components for a true E2E test
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { PrismaProducerRepository } from '../../src/core/producers/infrastructure/PrismaProducerRepository';
import { PrismaBatchRepository } from '../../src/core/batches/infrastructure/PrismaBatchRepository';
import { PrismaEventRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaEventRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../src/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '../../src/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';
import { RegisterEventUseCase } from '../../src/application/use-cases/events/RegisterEventUseCase';
import { GetEventByIdUseCase } from '../../src/application/use-cases/events/GetEventByIdUseCase';
import { CreateBatchUseCase } from '../../src/application/use-cases/batches/CreateBatchUseCase';
import { GetBatchByNumberUseCase } from '../../src/application/use-cases/batches/GetBatchByNumberUseCase';
import { GetBatchHistoryUseCase } from '../../src/application/use-cases/batches/GetBatchHistoryUseCase';
import { GetBatchByIdUseCase } from '../../src/application/use-cases/batches/GetBatchByIdUseCase';

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
    
    // Ensure consistent data state
    await runSeed();

    // Instantiate REAL repositories
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const producerRepository = new PrismaProducerRepository(prisma);
    const batchRepository = new PrismaBatchRepository(prisma);
    const eventRepository = new PrismaEventRepository(prisma);

    // Instantiate REAL use cases
    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
        logoutUseCase: new LogoutUseCase(redisClient),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
      },
      batches: {
        createBatchUseCase: new CreateBatchUseCase(batchRepository),
        getBatchByNumberUseCase: new GetBatchByNumberUseCase(batchRepository),
        getBatchHistoryUseCase: new GetBatchHistoryUseCase(batchRepository),
        getBatchByIdUseCase: new GetBatchByIdUseCase(batchRepository),
      },
      events: {
        registerEventUseCase: new RegisterEventUseCase(eventRepository),
        getEventByIdUseCase: new GetEventByIdUseCase(eventRepository),
      },
      producers: {} as any,
    };

    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    // Login as admin to get token
    const adminLoginRes = await request.post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'test123',
    });
    adminToken = adminLoginRes.body.data.accessToken;

    // Create a batch to associate events with - ensure producer exists
    const producer = await prisma.producer.findFirst({ where: { user: { email: 'producer@test.com' } } });
    if (!producer) throw new Error('Producer not found for Events E2E test');

    const batch = await prisma.batch.create({
      data: {
        producerId: producer.id,
        variety: 'HASS',
        origin: 'E2E Test Origin',
        weightKg: 500,
        status: 'REGISTERED',
        harvestDate: new Date(),
        blockchainHash: `0x${'b'.repeat(64)}`,
      }
    });
    testBatchId = batch.id;
  });

  afterAll(async () => {
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
        locationName: 'Test Location',
        notes: 'Initial harvest event for E2E test.'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.eventType).toBe(EventType.HARVEST);
  });
  
  it('POST /api/v1/events should fail for unauthorized user', async () => {
      const response = await request
        .post('/api/v1/events')
        .send({
          batchId: testBatchId,
          eventType: EventType.HARVEST,
        });
      
      expect(response.status).toBe(401);
  });
});
