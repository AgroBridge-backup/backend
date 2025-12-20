import express from 'express';
import 'express-async-errors';
import morgan from 'morgan';
import path from 'path';
import { AppError } from './shared/errors/AppError.js';
import { errorHandler } from './presentation/middlewares/errorHandler.middleware.js';
import { contextMiddleware } from './presentation/middlewares/context.middleware.js';
import logger from './shared/utils/logger.js';
import { createApiRouter } from './presentation/routes/index.js';
import { bullBoardSetup } from './infrastructure/notifications/monitoring/BullBoardSetup.js';
import { securityHeadersMiddleware, additionalSecurityHeaders } from './infrastructure/http/middleware/security.middleware.js';
import { corsMiddleware } from './infrastructure/http/middleware/cors.middleware.js';
import { RateLimiterConfig } from './infrastructure/http/middleware/rate-limiter.middleware.js';
import { auditMiddleware } from './infrastructure/http/middleware/audit.middleware.js';
import { correlationIdMiddleware } from './infrastructure/http/middleware/correlation-id.middleware.js';
import { performanceMiddleware } from './infrastructure/http/middleware/performance.middleware.js';
import { setupUncaughtExceptionHandler } from './infrastructure/http/middleware/error-tracking.middleware.js';
import healthRoutes from './presentation/routes/health.routes.js';
import { docsRouter } from './presentation/routes/docs.routes.js';
import { createGraphQLMiddleware, getGraphQLInfo } from './infrastructure/graphql/index.js';
import { createV2Router } from './presentation/routes/v2/index.js';
import { apiVersioning } from './infrastructure/http/middleware/apiVersioning.middleware.js';
import { basicAuthMiddleware } from './infrastructure/http/middleware/admin-auth.middleware.js';
setupUncaughtExceptionHandler();
import { prisma } from './infrastructure/database/prisma/client.js';
import { redisClient } from './infrastructure/cache/RedisClient.js';
import { PrismaUserRepository } from './infrastructure/database/prisma/repositories/PrismaUserRepository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository.js';
import { PrismaProducerRepository } from './core/producers/infrastructure/PrismaProducerRepository.js';
import { PrismaBatchRepository } from './core/batches/infrastructure/PrismaBatchRepository.js';
import { PrismaEventRepository } from './infrastructure/database/prisma/repositories/PrismaEventRepository.js';
import { GetCurrentUserUseCase } from './application/use-cases/auth/GetCurrentUserUseCase.js';
import { LoginUseCase } from './application/use-cases/auth/LoginUseCase.js';
import { LogoutUseCase } from './application/use-cases/auth/LogoutUseCase.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/RefreshTokenUseCase.js';
import { Setup2FAUseCase } from './application/use-cases/auth/Setup2FAUseCase.js';
import { Enable2FAUseCase } from './application/use-cases/auth/Enable2FAUseCase.js';
import { Disable2FAUseCase } from './application/use-cases/auth/Disable2FAUseCase.js';
import { Verify2FAUseCase } from './application/use-cases/auth/Verify2FAUseCase.js';
import { Get2FAStatusUseCase } from './application/use-cases/auth/Get2FAStatusUseCase.js';
import { RegenerateBackupCodesUseCase } from './application/use-cases/auth/RegenerateBackupCodesUseCase.js';
import { AddCertificationUseCase } from './application/use-cases/producers/AddCertificationUseCase.js';
import { GetProducerByIdUseCase } from './application/use-cases/producers/GetProducerByIdUseCase.js';
import { ListProducersUseCase } from './application/use-cases/producers/ListProducersUseCase.js';
import { WhitelistProducerUseCase } from './application/use-cases/producers/WhitelistProducerUseCase.js';
import { CreateBatchUseCase } from './application/use-cases/batches/CreateBatchUseCase.js';
import { GetBatchByIdUseCase } from './application/use-cases/batches/GetBatchByIdUseCase.js';
import { GetBatchByNumberUseCase } from './application/use-cases/batches/GetBatchByNumberUseCase.js';
import { GetBatchHistoryUseCase } from './application/use-cases/batches/GetBatchHistoryUseCase.js';
import { GetEventByIdUseCase } from './application/use-cases/events/GetEventByIdUseCase.js';
import { RegisterEventUseCase } from './application/use-cases/events/RegisterEventUseCase.js';
export function createApp(injectedRouter) {
    const app = express();
    let apiRouter = injectedRouter;
    if (!apiRouter) {
        const userRepository = new PrismaUserRepository(prisma);
        const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
        const producerRepository = new PrismaProducerRepository(prisma);
        const batchRepository = new PrismaBatchRepository();
        const eventRepository = new PrismaEventRepository(prisma);
        const useCases = {
            auth: {
                loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
                refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
                logoutUseCase: new LogoutUseCase(redisClient),
                getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
                setup2FAUseCase: new Setup2FAUseCase(userRepository),
                enable2FAUseCase: new Enable2FAUseCase(userRepository),
                disable2FAUseCase: new Disable2FAUseCase(userRepository),
                verify2FAUseCase: new Verify2FAUseCase(userRepository, refreshTokenRepository),
                get2FAStatusUseCase: new Get2FAStatusUseCase(userRepository),
                regenerateBackupCodesUseCase: new RegenerateBackupCodesUseCase(userRepository),
            },
            producers: {
                listProducersUseCase: new ListProducersUseCase(producerRepository),
                getProducerByIdUseCase: new GetProducerByIdUseCase(producerRepository),
                whitelistProducerUseCase: new WhitelistProducerUseCase(producerRepository),
                addCertificationUseCase: new AddCertificationUseCase(producerRepository),
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
            }
        };
        apiRouter = createApiRouter(useCases, prisma);
    }
    app.use('/health', healthRoutes);
    app.use('/', docsRouter);
    logger.info('Documentation available at /api-docs');
    app.use(securityHeadersMiddleware);
    app.use(additionalSecurityHeaders);
    app.use(correlationIdMiddleware);
    app.use(contextMiddleware);
    app.use(corsMiddleware);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }
    else {
        app.use(morgan('short', { stream: { write: (message) => logger.info(message.trim()) } }));
    }
    const adminPublicPath = path.join(process.cwd(), 'public', 'admin');
    app.use('/admin', express.static(adminPublicPath));
    app.get('/admin', (req, res) => {
        res.sendFile(path.join(adminPublicPath, 'index.html'));
    });
    logger.info(`Admin Dashboard available at /admin (${adminPublicPath})`);
    app.use(performanceMiddleware);
    app.use('/api', RateLimiterConfig.api());
    app.use(auditMiddleware);
    app.use('/api', apiVersioning);
    app.use('/api/v1', apiRouter);
    const v2Router = createV2Router(prisma, redisClient);
    app.use('/api/v2', v2Router);
    const graphqlMiddleware = createGraphQLMiddleware({
        prisma,
        isDevelopment: process.env.NODE_ENV !== 'production',
        enableIntrospection: process.env.NODE_ENV !== 'production',
    });
    app.all('/graphql', graphqlMiddleware);
    app.all('/graphql/*', graphqlMiddleware);
    app.get('/api/graphql-info', (req, res) => {
        res.json(getGraphQLInfo());
    });
    app.use('/admin/queues', basicAuthMiddleware, bullBoardSetup.getRouter());
    app.get('/api/v1/status', (req, res) => {
        res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
    });
    app.use('/api', (req, res, next) => {
        next(new AppError(`The route ${req.method} ${req.originalUrl} does not exist.`, 404));
    });
    app.use(errorHandler);
    return app;
}
export const app = createApp();
