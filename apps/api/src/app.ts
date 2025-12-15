// FIX: ARCHITECTURAL REFACTOR TO ALIGN WITH FACTORY PATTERN & DI
import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import morgan from 'morgan';
import { AppError } from './shared/errors/AppError.js';
import { errorHandler } from './presentation/middlewares/errorHandler.middleware.js';
import { contextMiddleware } from './presentation/middlewares/context.middleware.js';
import logger from './shared/utils/logger.js';
import { createApiRouter } from './presentation/routes/index.js';
import { bullBoardSetup } from './infrastructure/notifications/monitoring/BullBoardSetup.js';

// Security Middleware
import { securityHeadersMiddleware, additionalSecurityHeaders } from './infrastructure/http/middleware/security.middleware.js';
import { corsMiddleware } from './infrastructure/http/middleware/cors.middleware.js';
import { RateLimiterConfig } from './infrastructure/http/middleware/rate-limiter.middleware.js';
import { auditMiddleware } from './infrastructure/http/middleware/audit.middleware.js';

// Observability Middleware
import { correlationIdMiddleware } from './infrastructure/http/middleware/correlation-id.middleware.js';
import { performanceMiddleware } from './infrastructure/http/middleware/performance.middleware.js';
import { errorTrackingMiddleware, setupUncaughtExceptionHandler } from './infrastructure/http/middleware/error-tracking.middleware.js';

// Health Routes
import healthRoutes from './presentation/routes/health.routes.js';

// Documentation Routes
import { docsRouter } from './presentation/routes/docs.routes.js';

// GraphQL Server
import { createGraphQLMiddleware, getGraphQLInfo } from './infrastructure/graphql/index.js';

// API v2 Routes
import { createV2Router } from './presentation/routes/v2/index.js';

// API Versioning Middleware
import { apiVersioning } from './infrastructure/http/middleware/apiVersioning.middleware.js';

// Admin Auth Middleware
import { basicAuthMiddleware } from './infrastructure/http/middleware/admin-auth.middleware.js';

// Setup global error handlers
setupUncaughtExceptionHandler();

// --- DEPENDENCY INJECTION WIRING (Centralized) ---
import { prisma } from './infrastructure/database/prisma/client.js';
import { redisClient } from './infrastructure/cache/RedisClient.js';

// Repositories
import { PrismaUserRepository } from './infrastructure/database/prisma/repositories/PrismaUserRepository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository.js';
import { PrismaProducerRepository } from './core/producers/infrastructure/PrismaProducerRepository.js';
import { PrismaBatchRepository } from './core/batches/infrastructure/PrismaBatchRepository.js';
import { PrismaEventRepository } from './infrastructure/database/prisma/repositories/PrismaEventRepository.js';

// Use Cases
import { AllUseCases } from './application/use-cases/index.js';
// FIX: Direct imports to break circular dependencies
import { GetCurrentUserUseCase } from './application/use-cases/auth/GetCurrentUserUseCase.js';
import { LoginUseCase } from './application/use-cases/auth/LoginUseCase.js';
import { LogoutUseCase } from './application/use-cases/auth/LogoutUseCase.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/RefreshTokenUseCase.js';
// Two-Factor Authentication Use Cases
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

import { Router } from 'express';

export function createApp(injectedRouter?: Router): express.Express {
    const app = express();

    // --- SETUP DEPENDENCIES ---
    // Only setup default dependencies if no router is injected
    let apiRouter = injectedRouter;

    if (!apiRouter) {
        const userRepository = new PrismaUserRepository(prisma);
        const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
        const producerRepository = new PrismaProducerRepository(prisma);
        const batchRepository = new PrismaBatchRepository();
        const eventRepository = new PrismaEventRepository(prisma);

        const useCases: AllUseCases = {
            auth: {
                loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
                refreshTokenUseCase: new RefreshTokenUseCase(refreshTokenRepository, userRepository),
                logoutUseCase: new LogoutUseCase(redisClient),
                getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
                // Two-Factor Authentication
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

    // ═══════════════════════════════════════════════════════════════════════════════
    // MIDDLEWARE PIPELINE (Order is critical for security and observability)
    // ═══════════════════════════════════════════════════════════════════════════════

    // 1. HEALTH ROUTES (No middleware - must be accessible for probes)
    app.use('/health', healthRoutes);

    // 1.5. DOCUMENTATION ROUTES (No auth required - public documentation)
    app.use('/', docsRouter);
    logger.info('Documentation available at /api-docs');

    // 2. SECURITY: Headers (Helmet.js + CSP) - Applied first for max protection
    app.use(securityHeadersMiddleware);
    app.use(additionalSecurityHeaders);

    // 3. OBSERVABILITY: Correlation ID - Generate/propagate request tracking ID
    app.use(correlationIdMiddleware);

    // 4. Request Context (legacy - generates requestId for tracking)
    app.use(contextMiddleware);

    // 5. SECURITY: CORS with Whitelist
    app.use(corsMiddleware);

    // 6. Body Parsers
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // 7. OBSERVABILITY: Request Logging (Morgan)
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    } else {
        app.use(morgan('short', { stream: { write: (message) => logger.info(message.trim()) } }));
    }

    // 8. OBSERVABILITY: Performance Monitoring
    app.use(performanceMiddleware);

    // 9. SECURITY: Global API Rate Limiting
    app.use('/api', RateLimiterConfig.api());

    // 10. COMPLIANCE: Audit Logging (after rate limiting, before routes)
    app.use(auditMiddleware);

    // ═══════════════════════════════════════════════════════════════════════════════
    // API ROUTES
    // ═══════════════════════════════════════════════════════════════════════════════

    // API Versioning Middleware
    app.use('/api', apiVersioning);

    // API v1 Routes (legacy)
    app.use('/api/v1', apiRouter);

    // API v2 Routes (enhanced with field selection, filtering, etc.)
    const v2Router = createV2Router(prisma, redisClient);
    app.use('/api/v2', v2Router);

    // ═══════════════════════════════════════════════════════════════════════════════
    // GRAPHQL API
    // ═══════════════════════════════════════════════════════════════════════════════
    const graphqlMiddleware = createGraphQLMiddleware({
        prisma,
        isDevelopment: process.env.NODE_ENV !== 'production',
        enableIntrospection: process.env.NODE_ENV !== 'production',
    });

    // GraphQL endpoint (supports both GET and POST)
    app.all('/graphql', graphqlMiddleware);
    app.all('/graphql/*', graphqlMiddleware);

    // GraphQL API info endpoint
    app.get('/api/graphql-info', (req: Request, res: Response) => {
        res.json(getGraphQLInfo());
    });

    // --- ADMIN ROUTES ---
    // Bull Board queue monitoring dashboard (protected by basic auth)
    app.use('/admin/queues', basicAuthMiddleware, bullBoardSetup.getRouter());

    app.get('/api/v1/status', (req: Request, res: Response) => {
        res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
    });

    app.use('/api', (req: Request, res: Response, next: NextFunction) => {
        next(new AppError(`The route ${req.method} ${req.originalUrl} does not exist.`, 404));
    });

    app.use(errorHandler);

    return app;
}

export const app = createApp();

