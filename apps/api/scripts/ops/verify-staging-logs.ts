import logger from '../../src/shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Simulate Staging Environment
process.env.NODE_ENV = 'production';
process.env.DATADOG_API_KEY = 'dummy_key_for_validation';

// Simulate a Request Context
const mockReq = {
    context: {
        traceId: uuidv4(),
        startTime: Date.now()
    },
    user: {
        userId: 'user-uuid-staging-001',
        producerId: 'prod-uuid-staging-999'
    },
    path: '/api/v1/staging-validation'
};

console.log('--- START STAGING LOG VALIDATION ---');

// 1. Log Info
logger.info({
    traceId: mockReq.context.traceId,
    userId: mockReq.user.userId,
    producerId: mockReq.user.producerId,
    route: mockReq.path,
    message: 'Staging Deployment Validation - Info Log',
    meta: {
        deployVersion: '1.2.1',
        region: 'us-east-1'
    }
});

// 2. Log Error
try {
    throw new Error('Simulated Staging DB Connection Timeout');
} catch (err: any) {
    logger.error({
        traceId: mockReq.context.traceId,
        userId: mockReq.user.userId,
        route: mockReq.path,
        message: 'Staging Validation - Error Scenario',
        meta: {
            error: err.message,
            stack: err.stack,
            component: 'Database'
        }
    });
}

console.log('--- END STAGING LOG VALIDATION ---');
