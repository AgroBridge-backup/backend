import 'dotenv/config';
import { createApp } from './app';
import { createApiRouter } from './presentation/routes';
import { redisClient } from './infrastructure/cache/RedisClient';
import { logger } from './shared/utils/logger';

// DB and Repo Imports
import { PrismaClient } from '@prisma/client';
import { PrismaUserRepository } from './infrastructure/database/prisma/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from './infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository';
// Import other repositories as they are created...

// Use Case Imports
import { AllUseCases } from './application/use-cases';
import { LoginUseCase } from './application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from './application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from './application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from './application/use-cases/auth/GetCurrentUserUseCase';
import { CreateBatchUseCase } from './application/use-cases/batches/CreateBatchUseCase';
import { GetBatchByNumberUseCase } from './application/use-cases/batches/GetBatchByNumberUseCase';
import { GetBatchHistoryUseCase } from './application/use-cases/batches/GetBatchHistoryUseCase';
import { RegisterEventUseCase } from './application/use-cases/events/RegisterEventUseCase';
import { GetEventByIdUseCase } from './application/use-cases/events/GetEventByIdUseCase';
import { ListProducersUseCase } from './application/use-cases/producers/ListProducersUseCase';
import { GetProducerByIdUseCase } from './application/use-cases/producers/GetProducerByIdUseCase';
import { WhitelistProducerUseCase } from './application/use-cases/producers/WhitelistProducerUseCase';
import { AddCertificationUseCase } from './application/use-cases/producers/AddCertificationUseCase';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  console.log('[BOOTSTRAP] Step 1: Starting...');

  try {
    console.log('[BOOTSTRAP] Step 2: Connecting to PostgreSQL...');
    console.log('[BOOTSTRAP] DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    // 1. Initialize and connect to DB
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('[BOOTSTRAP] Step 3: PostgreSQL connected ✓');

    console.log('[BOOTSTRAP] Step 4: Connecting to Redis...');
    await redisClient.ping();
    console.log('[BOOTSTRAP] Step 5: Redis connected ✓');

    // Instantiate dependencies
    const userRepository = new PrismaUserRepository(prisma);
    const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
    const useCases: AllUseCases = {
      auth: {
        loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
        refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
        logoutUseCase: new LogoutUseCase(redisClient),
        getCurrentUserUseCase: new GetCurrentUserUseCase(),
      },
      batches: {
        createBatchUseCase: new CreateBatchUseCase(null as any, null as any, null as any, null as any),
        getBatchByNumberUseCase: new GetBatchByNumberUseCase(),
        getBatchHistoryUseCase: new GetBatchHistoryUseCase(),
      },
      events: {
        registerEventUseCase: new RegisterEventUseCase(null as any, null as any, null as any, null as any),
        getEventByIdUseCase: new GetEventByIdUseCase(),
        getBatchHistoryUseCase: new GetBatchHistoryUseCase(),
      },
      producers: {
        listProducersUseCase: new ListProducersUseCase(),
        getProducerByIdUseCase: new GetProducerByIdUseCase(),
        whitelistProducerUseCase: new WhitelistProducerUseCase(),
        addCertificationUseCase: new AddCertificationUseCase(),
      },
    };
    
    console.log('[BOOTSTRAP] Step 6: Starting Express server...');
    const apiRouter = createApiRouter(useCases);
    const app = createApp(apiRouter);

    app.listen(PORT, () => {
      console.log('[BOOTSTRAP] Step 7: Server listening on port', PORT, '✓');
    });
  } catch (error: any) {
    console.error('[BOOTSTRAP] FATAL ERROR:', error);
    process.exit(1);
  }
}

console.log('[BOOTSTRAP] Step 0: Calling bootstrap()');
bootstrap();
