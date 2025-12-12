// temp_runner.ts
// This is a temporary script to bypass the broken build toolchain and run the application directly.

import 'dotenv/config';
import { createApp } from './apps/api/src/app.js';
import { createApiRouter } from './apps/api/src/presentation/routes/index.js';
import { redisClient } from './apps/api/src/infrastructure/cache/RedisClient.js';
import { PrismaClient } from '@prisma/client';
import { PrismaUserRepository } from './apps/api/src/infrastructure/database/prisma/repositories/PrismaUserRepository.js';
import { PrismaRefreshTokenRepository } from './apps/api/src/infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository.js';
import { PrismaProducerRepository } from './apps/api/src/core/producers/infrastructure/PrismaProducerRepository.js';
import { AllUseCases } from './apps/api/src/application/use-cases/index.js';
import { LoginUseCase } from './apps/api/src/application/use-cases/auth/LoginUseCase.js';
import { RefreshTokenUseCase } from './apps/api/src/application/use-cases/auth/RefreshTokenUseCase.js';
import { LogoutUseCase } from './apps/api/src/application/use-cases/auth/LogoutUseCase.js';
import { GetCurrentUserUseCase } from './apps/api/src/application/use-cases/auth/GetCurrentUserUseCase.js';
import { ListProducersUseCase } from './apps/api/src/application/use-cases/producers/ListProducersUseCase.js';

async function start() {
  console.log('[RUNNER] Bypassing build, starting app directly...');
  
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('[RUNNER] PostgreSQL connected.');
    await redisClient.ping();
    console.log('[RUNNER] Redis connected.');

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
      },
    } as any;

    const apiRouter = createApiRouter(useCases);
    const app = createApp(apiRouter);

    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`[RUNNER] Server listening on http://localhost:${port}`);
    });

  } catch (error) {
    console.error("[RUNNER] Failed to start server:", error);
    process.exit(1);
  }
}

start();
