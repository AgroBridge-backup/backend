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

  // Unique data for this test suite
  const uniqueSuffix = Date.now();
  const adminEmail = `admin-producers-${uniqueSuffix}@test.com`;
  const producer1Email = `producer1-${uniqueSuffix}@test.com`;
  const producer2Email = `producer2-${uniqueSuffix}@test.com`;
  const password = 'test123';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    await redisClient.client.flushdb();

    // Seed data specific for this test suite
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create Admin
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
      },
    });

    // 2. Create Whitelisted Producer
    await prisma.user.create({
      data: {
        email: producer1Email,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'Producer',
        lastName: 'One',
        isActive: true,
        producer: {
          create: {
            businessName: 'Whitelisted Producer',
            rfc: `RFC1-${uniqueSuffix}`,
            state: 'Michoacán',
            municipality: 'Uruapan',
            latitude: 19.4136,
            longitude: -102.062,
            isWhitelisted: true,
          },
        },
      },
    });

    // 3. Create Non-Whitelisted Producer
    await prisma.user.create({
      data: {
        email: producer2Email,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'Producer',
        lastName: 'Two',
        isActive: true,
        producer: {
          create: {
            businessName: 'Non-Whitelisted Producer',
            rfc: `RFC2-${uniqueSuffix}`,
            state: 'Jalisco',
            municipality: 'Guadalajara',
            latitude: 20.6597,
            longitude: -103.3496,
            isWhitelisted: false,
          },
        },
      },
    });

    // Instantiate repositories and use cases
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const producerRepository = new PrismaProducerRepository(prisma);

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
      batches: {} as any,
      events: {} as any,
    };

    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);

    // Login as admin
    const adminLoginRes = await request.post('/api/v1/auth/login').send({
      email: adminEmail,
      password: password,
    });
    adminToken = adminLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up specific data
    await prisma.producer.deleteMany({
        where: {
            rfc: { in: [`RFC1-${uniqueSuffix}`, `RFC2-${uniqueSuffix}`] }
        }
    });
    await prisma.user.deleteMany({
        where: {
            email: { in: [adminEmail, producer1Email, producer2Email] }
        }
    });
    
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  describe('GET /api/v1/producers', () => {
    it('should return the first page of producers', async () => {
      const response = await request
        .get('/api/v1/producers?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      // We expect at least our 2 created producers
      expect(response.body.producers.length).toBeGreaterThanOrEqual(2);
      
      // Verify our specific producer is in the list
      const names = response.body.producers.map((p: any) => p.businessName);
      expect(names).toContain('Whitelisted Producer');
      expect(names).toContain('Non-Whitelisted Producer');
    });

    it('should filter whitelisted producers', async () => {
        const response = await request
          .get('/api/v1/producers?isWhitelisted=true')
          .set('Authorization', `Bearer ${adminToken}`);
        
        expect(response.status).toBe(200);
        
        // Verify results are whitelisted
        const producers = response.body.producers;
        expect(producers.length).toBeGreaterThan(0);
        producers.forEach((p: any) => {
            expect(p.isWhitelisted).toBe(true);
        });

        // Verify our non-whitelisted producer is NOT present
        const names = producers.map((p: any) => p.businessName);
        expect(names).not.toContain('Non-Whitelisted Producer');
        expect(names).toContain('Whitelisted Producer');
    });
  });
});
