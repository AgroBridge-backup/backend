// FIX: ARCHITECTURAL REFACTOR TO ALIGN WITH FACTORY PATTERN & DI
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import morgan from 'morgan';
import { AppError } from './shared/errors/AppError.js';
import { errorHandler } from './presentation/middlewares/errorHandler.middleware.js';
import { contextMiddleware } from './presentation/middlewares/context.middleware.js';
import logger from './shared/utils/logger.js';
import { createApiRouter } from './presentation/routes/index.js';
import { helmetConfig, additionalSecurityHeaders, globalLimiter, validateRequestSize, sanitizeInput, corsOptions, } from './presentation/middlewares/security.middleware.js';
import { requestLogger, performanceMonitor, accessLogger, } from './presentation/middlewares/logging.middleware.js';
// --- DEPENDENCY INJECTION WIRING (Centralized) ---
import { prisma } from './infrastructure/database/prisma/client.js';
import { redisClient } from './infrastructure/cache/RedisClient.js';
// Repositories
import { PrismaUserRepository } from './infrastructure/database/prisma/repositories/PrismaUserRepository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/database/prisma/repositories/PrismaRefreshTokenRepository.js';
import { PrismaProducerRepository } from './core/producers/infrastructure/PrismaProducerRepository.js';
import { PrismaBatchRepository } from './core/batches/infrastructure/PrismaBatchRepository.js';
import { PrismaEventRepository } from './infrastructure/database/prisma/repositories/PrismaEventRepository.js';
// FIX: Direct imports to break circular dependencies
import { GetCurrentUserUseCase } from './application/use-cases/auth/GetCurrentUserUseCase.js';
import { LoginUseCase } from './application/use-cases/auth/LoginUseCase.js';
import { LogoutUseCase } from './application/use-cases/auth/LogoutUseCase.js';
import { RefreshTokenUseCase } from './application/use-cases/auth/RefreshTokenUseCase.js';
import { AddCertificationUseCase } from './application/use-cases/producers/AddCertificationUseCase.js';
import { GetProducerByIdUseCase } from './application/use-cases/producers/GetProducerByIdUseCase.js';
import { ListProducersUseCase } from './application/use-cases/producers/ListProducersUseCase.js';
import { WhitelistProducerUseCase } from './application/use-cases/producers/WhitelistProducerUseCase.js';
import { DeleteProducerUseCase } from './application/use-cases/producers/DeleteProducerUseCase.js';
import { VerifyProducerUseCase } from './application/use-cases/producers/VerifyProducerUseCase.js';
import { GetProducerStatsUseCase } from './application/use-cases/producers/GetProducerStatsUseCase.js';
import { GetProducerBatchesUseCase } from './application/use-cases/producers/GetProducerBatchesUseCase.js';
import { SearchProducersUseCase } from './application/use-cases/producers/SearchProducersUseCase.js';
import { CreateBatchUseCase } from './application/use-cases/batches/CreateBatchUseCase.js';
import { GetBatchByIdUseCase } from './application/use-cases/batches/GetBatchByIdUseCase.js';
import { GetBatchByNumberUseCase } from './application/use-cases/batches/GetBatchByNumberUseCase.js';
import { GetBatchHistoryUseCase } from './application/use-cases/batches/GetBatchHistoryUseCase.js';
import { DeleteBatchUseCase } from './application/use-cases/batches/DeleteBatchUseCase.js';
import { UpdateBatchStatusUseCase } from './application/use-cases/batches/UpdateBatchStatusUseCase.js';
import { GenerateQrCodeUseCase } from './application/use-cases/batches/GenerateQrCodeUseCase.js';
import { GetBatchTimelineUseCase } from './application/use-cases/batches/GetBatchTimelineUseCase.js';
import { GetEventByIdUseCase } from './application/use-cases/events/GetEventByIdUseCase.js';
import { RegisterEventUseCase } from './application/use-cases/events/RegisterEventUseCase.js';
import { ListEventsUseCase } from './application/use-cases/events/ListEventsUseCase.js';
import { GetBatchEventsUseCase } from './application/use-cases/events/GetBatchEventsUseCase.js';
import { DeleteEventUseCase } from './application/use-cases/events/DeleteEventUseCase.js';
import { UpdateEventUseCase } from './application/use-cases/events/UpdateEventUseCase.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './infrastructure/docs/openapi.config.js';
export function createApp(injectedRouter) {
    const app = express();
    // --- SETUP DEPENDENCIES ---
    // Only setup default dependencies if no router is injected
    let apiRouter = injectedRouter;
    if (!apiRouter) {
        const userRepository = new PrismaUserRepository(prisma);
        const refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
        const producerRepository = new PrismaProducerRepository(prisma);
        const batchRepository = new PrismaBatchRepository(prisma);
        const eventRepository = new PrismaEventRepository(prisma);
        const useCases = {
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
                deleteProducerUseCase: new DeleteProducerUseCase(producerRepository, batchRepository),
                verifyProducerUseCase: new VerifyProducerUseCase(producerRepository),
                getProducerStatsUseCase: new GetProducerStatsUseCase(producerRepository),
                getProducerBatchesUseCase: new GetProducerBatchesUseCase(producerRepository, batchRepository),
                searchProducersUseCase: new SearchProducersUseCase(producerRepository),
            },
            batches: {
                createBatchUseCase: new CreateBatchUseCase(batchRepository),
                getBatchByNumberUseCase: new GetBatchByNumberUseCase(batchRepository),
                getBatchHistoryUseCase: new GetBatchHistoryUseCase(batchRepository),
                getBatchByIdUseCase: new GetBatchByIdUseCase(batchRepository),
                deleteBatchUseCase: new DeleteBatchUseCase(batchRepository, producerRepository),
                updateBatchStatusUseCase: new UpdateBatchStatusUseCase(batchRepository, eventRepository),
                generateQrCodeUseCase: new GenerateQrCodeUseCase(batchRepository),
                getBatchTimelineUseCase: new GetBatchTimelineUseCase(batchRepository, eventRepository),
            },
            events: {
                registerEventUseCase: new RegisterEventUseCase(eventRepository),
                getEventByIdUseCase: new GetEventByIdUseCase(eventRepository),
                listEventsUseCase: new ListEventsUseCase(eventRepository),
                getBatchEventsUseCase: new GetBatchEventsUseCase(eventRepository, batchRepository),
                deleteEventUseCase: new DeleteEventUseCase(eventRepository),
                updateEventUseCase: new UpdateEventUseCase(eventRepository),
            }
        };
        apiRouter = createApiRouter(useCases);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY MIDDLEWARE (Apply BEFORE routes)
    // ═══════════════════════════════════════════════════════════════════════════
    // Trust proxy for rate limiting (if behind reverse proxy)
    if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }
    // Enhanced Helmet with CSP, HSTS, and security headers
    app.use(helmetConfig);
    app.use(additionalSecurityHeaders);
    // Context middleware (adds trace IDs - must be FIRST for tracking)
    app.use(contextMiddleware);
    // Logging middleware (uses trace IDs from context)
    app.use(requestLogger);
    app.use(performanceMonitor);
    app.use(accessLogger);
    // CORS with multiple allowed origins
    app.use(cors(corsOptions));
    // Request size validation
    app.use(validateRequestSize);
    // Body parsers with size limits
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    // Input sanitization (XSS protection)
    app.use(sanitizeInput);
    // HTTP request logging
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }
    else {
        app.use(morgan('short', { stream: { write: (message) => logger.info(message.trim()) } }));
    }
    // Global rate limiter for all API routes
    app.use('/api/', globalLimiter);
    // --- API DOCUMENTATION ---
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'AgroBridge API Documentation',
        customCss: '.swagger-ui .topbar { display: none }',
        customfavIcon: '/favicon.ico',
    }));
    app.get('/api-docs.json', (_, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(swaggerSpec);
    });
    // --- API ROUTES ---
    app.use('/api/v1', apiRouter);
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
