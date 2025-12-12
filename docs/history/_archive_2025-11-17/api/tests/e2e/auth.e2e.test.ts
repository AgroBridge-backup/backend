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

describe('Auth API E2E', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Manually create the app instance with correct dependency injection for testing
    prisma = new PrismaClient();
    await prisma.$connect();

    // Instantiate Repositories
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);

    // Instantiate Use Cases with their dependencies
    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
        logoutUseCase: new LogoutUseCase(redisClient),
        getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository), // Assuming it needs the repo
      },
      // Stubs for other modules
      batches: {} as any,
      events: {} as any,
      producers: {} as any,
    };
    const apiRouter = createApiRouter(useCases);
    app = createApp(apiRouter);
    request = supertest(app);
  });

  beforeEach(async () => {
    // Clear Redis before each test to ensure a clean state
    await redisClient.client.flushdb();
  });

  afterAll(async () => {
    // Clean up database and close connections
    await prisma.refreshToken.deleteMany();
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
        .send({ email: 'admin@test.com', password: 'test123' });
  
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should blacklist the token, preventing further access', async () => {
      // 1. Login to get a token
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'test123' });
      
      const { accessToken } = loginRes.body;
      expect(accessToken).toBeDefined();

      // 2. Verify token works
      const meRes1 = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(meRes1.status).toBe(200);
      expect(meRes1.body.email).toBe('admin@test.com');

      // 3. Logout
      const logoutRes = await request.post('/api/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`);
      expect(logoutRes.status).toBe(204);

      // 4. Verify token is now blacklisted and fails
      const meRes2 = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(meRes2.status).toBe(401);
      expect(meRes2.body.message).toContain('Token has been revoked');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new tokens and revoke the old refresh token', async () => {
      // 1. Login to get tokens
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ email: 'producer@test.com', password: 'prodpass' });
      
      const { refreshToken: oldRefreshToken } = loginRes.body;
      expect(oldRefreshToken).toBeDefined();

      // 2. Use the refresh token to get new tokens
      const refreshRes1 = await request.post('/api/v1/auth/refresh').send({ refreshToken: oldRefreshToken });
      expect(refreshRes1.status).toBe(200);
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshRes1.body;
      expect(newAccessToken).toBeDefined();
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toEqual(oldRefreshToken);

      // 3. Verify the new access token works
      const meRes = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${newAccessToken}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('producer@test.com');

      // 4. Verify the old refresh token is now revoked
      const refreshRes2 = await request.post('/api/v1/auth/refresh').send({ refreshToken: oldRefreshToken });
      expect(refreshRes2.status).toBe(401);
      expect(refreshRes2.body.message).toContain('Refresh token is revoked or expired');
    });
  });
});