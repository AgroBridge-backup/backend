import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { Express } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { createApp } from '../../src/app';
import { createApiRouter } from '../../src/presentation/routes';
import { AllUseCases } from '../../src/application/use-cases';
import bcrypt from 'bcryptjs';

// Import all required components for DI
import { redisClient } from '../../src/infrastructure/cache/RedisClient';
import { PrismaUserRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../src/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '../../src/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/auth/GetCurrentUserUseCase';

describe('Auth API E2E', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  
  // Unique users for this test suite
  const uniqueSuffix = Date.now();
  const adminEmail = `admin-${uniqueSuffix}@test.com`;
  const producerEmail = `producer-${uniqueSuffix}@test.com`;
  const password = 'test123';

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Create unique users for this suite
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        firstName: 'Auth',
        lastName: 'Admin',
        isActive: true,
      }
    });

    await prisma.user.create({
      data: {
        email: producerEmail,
        passwordHash: hashedPassword,
        role: UserRole.PRODUCER,
        firstName: 'Auth',
        lastName: 'Producer',
        isActive: true,
        producer: {
            create: {
                businessName: 'Auth Producer',
                rfc: `AUTH${uniqueSuffix}`,
                state: 'Test',
                municipality: 'Test',
                latitude: 0,
                longitude: 0,
                isWhitelisted: true
            }
        }
      }
    });

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
    };
    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);
  });

  beforeEach(async () => {
    await redisClient.client.flushdb();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    // Clean up created users
    await prisma.user.deleteMany({
        where: { email: { in: [adminEmail, producerEmail] } }
    });
    await prisma.$disconnect();
    await redisClient.client.quit();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should fail with wrong credentials', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrong' });
      
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid credentials');
    });
  
    it('should succeed with correct credentials and return tokens', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: password });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should blacklist the token, preventing further access', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: password });
      
      const { accessToken } = loginRes.body;
      expect(accessToken).toBeDefined();

      const meRes1 = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(meRes1.status).toBe(200);
      expect(meRes1.body.email).toBe(adminEmail);

      const logoutRes = await request.post('/api/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`);
      expect(logoutRes.status).toBe(204);

      const meRes2 = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(meRes2.status).toBe(401);
      expect(meRes2.body.message).toContain('Token has been revoked');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new tokens and revoke the old refresh token', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ email: producerEmail, password: password });
      
      const { refreshToken: oldRefreshToken } = loginRes.body;
      expect(oldRefreshToken).toBeDefined();

      const refreshRes1 = await request.post('/api/v1/auth/refresh').send({ refreshToken: oldRefreshToken });
      expect(refreshRes1.status).toBe(200);
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshRes1.body;
      expect(newAccessToken).toBeDefined();
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toEqual(oldRefreshToken);

      const meRes = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${newAccessToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe(producerEmail);

      const refreshRes2 = await request.post('/api/v1/auth/refresh').send({ refreshToken: oldRefreshToken });

      expect(refreshRes2.status).toBe(401);
      expect(refreshRes2.body.message).toContain('Refresh token is revoked or expired');
    });
  });
});
