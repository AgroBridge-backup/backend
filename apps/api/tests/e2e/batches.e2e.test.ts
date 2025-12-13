import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';

// Import REAL components for a true E2E test
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { PrismaBatchRepository } from '../../src/core/batches/infrastructure/PrismaBatchRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../src/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '../../src/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';
import { CreateBatchUseCase } from '../../src/application/use-cases/batches/CreateBatchUseCase';
import { GetBatchByIdUseCase } from '../../src/application/use-cases/batches/GetBatchByIdUseCase';
import { GetBatchByNumberUseCase } from '../../src/application/use-cases/batches/GetBatchByNumberUseCase';
import { GetBatchHistoryUseCase } from '../../src/application/use-cases/batches/GetBatchHistoryUseCase';

describe('Batches API (E2E)', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let producerToken: string;
  let createdBatchId: string;

  // Unique data
  const uniqueSuffix = Date.now();
  const producerEmail = `producer-batch-${uniqueSuffix}@test.com`;
  const password = 'prodpass';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await redisClient.client.flushdb();

    // 1. Create Producer User for this test
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
        data: {
            email: producerEmail,
            passwordHash: hashedPassword,
            role: UserRole.PRODUCER,
            firstName: 'Batch',
            lastName: 'Tester',
            isActive: true,
            producer: {
                create: {
                    businessName: 'Batch Producer Inc.',
                    rfc: `RFCB-${uniqueSuffix}`,
                    state: 'Michoacán',
                    municipality: 'Uruapan',
                    isWhitelisted: true,
                    latitude: 19.4136,
                    longitude: -102.062
                }
            }
        }
    });

    // Instantiate REAL repositories
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const batchRepository = new PrismaBatchRepository(prisma);

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
        getBatchByIdUseCase: new GetBatchByIdUseCase(batchRepository),
        getBatchByNumberUseCase: new GetBatchByNumberUseCase(batchRepository),
        getBatchHistoryUseCase: new GetBatchHistoryUseCase(batchRepository),
      },
      events: {} as any,
      producers: {} as any,
    };

    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    // Login
    const loginRes = await request
      .post('/api/v1/auth/login')
      .send({ email: producerEmail, password: password });

    producerToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (createdBatchId) {
      try { await prisma.batch.delete({ where: { id: createdBatchId } }); } catch (e) {}
    }
    await prisma.user.deleteMany({ where: { email: producerEmail } });
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  it('POST /api/v1/batches should return 201 when creating a new batch with a producer token', async () => {
    const response = await request
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${producerToken}`)
      .send({
        batchNumber: `BATCH-${uniqueSuffix}`,
        cropType: 'Avocado',
        variety: 'HASS',
        quantity: 1000,
        parcelName: 'Test Parcel',
        latitude: 19.4,
        longitude: -102.0,
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