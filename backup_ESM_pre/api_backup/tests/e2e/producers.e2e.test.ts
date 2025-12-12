import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';

// Import REAL components for a true E2E test
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { PrismaProducerRepository } from '../../src/core/producers/infrastructure/PrismaProducerRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../src/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '../../src/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';
import { ListProducersUseCase } from '../../src/application/use-cases/producers/ListProducersUseCase';
import { GetProducerByIdUseCase } from '../../src/application/use-cases/producers/GetProducerByIdUseCase';
import { WhitelistProducerUseCase } from '../../src/application/use-cases/producers/WhitelistProducerUseCase';
import { AddCertificationUseCase } from '../../src/application/use-cases/producers/AddCertificationUseCase';

describe('Producers API (E2E)', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let adminToken: string;

  beforeAll(async () => {
    // Single Prisma instance for the entire test suite
    prisma = new PrismaClient();
    await prisma.$connect();
    await redisClient.client.flushdb();

    // Instantiate REAL repositories
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const producerRepository = new PrismaProducerRepository(prisma);

    // Instantiate REAL use cases for a true E2E test
    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
        logoutUseCase: new LogoutUseCase(redisClient),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
      },
      producers: {
        listProducersUseCase: new ListProducersUseCase(producerRepository),
        getProducerByIdUseCase: new GetProducerByIdUseCase(producerRepository),
        whitelistProducerUseCase: new WhitelistProducerUseCase(producerRepository),
        addCertificationUseCase: new AddCertificationUseCase(producerRepository),
      },
      batches: {} as any, // Stub other modules
      events: {} as any,
    };

    // Create the app with the real dependencies
    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    // Get an admin token to perform authenticated requests
    const adminLoginRes = await request.post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'test123',
    });
    adminToken = adminLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // FIX: prisma teardown for test stability
    // Gracefully disconnect from all services
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  describe('GET /api/v1/producers', () => {
    it('should return the first page of producers from the seeded data', async () => {
      const response = await request
        .get('/api/v1/producers?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.producers).toHaveLength(1);
      // The seed script creates 2 producers
      expect(response.body.total).toBe(2);
    });

    it('should filter whitelisted producers from the seeded data', async () => {
        const response = await request
          .get('/api/v1/producers?isWhitelisted=true')
          .set('Authorization', `Bearer ${adminToken}`);
        
        expect(response.status).toBe(200);
        // The seed script creates 1 whitelisted and 1 not
        expect(response.body.total).toBe(1);
        expect(response.body.producers[0].isWhitelisted).toBe(true);
    });
  });
});