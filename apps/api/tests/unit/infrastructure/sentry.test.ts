/**
 * Sentry APM Integration Tests
 *
 * Tests for the Sentry error tracking and performance monitoring integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock Sentry before importing the module
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
  setUser: vi.fn(),
  setExtra: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  startSpan: vi.fn((options, fn) => fn()),
  withScope: vi.fn((fn) => fn({ setExtra: vi.fn(), setUser: vi.fn() })),
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => ({})),
}));

describe('Sentry APM Integration', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockRequest = {
      method: 'GET',
      url: '/api/v1/test',
      path: '/api/v1/test',
      query: {},
      headers: {
        'user-agent': 'test-agent',
        'content-type': 'application/json',
        host: 'localhost',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initSentry', () => {
    it('should skip initialization in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const { initSentry } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip initialization without DSN in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDsn = process.env.SENTRY_DSN;
      process.env.NODE_ENV = 'production';
      delete process.env.SENTRY_DSN;

      vi.resetModules();
      const { initSentry } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      initSentry();

      // init is not called because DSN is missing
      process.env.NODE_ENV = originalEnv;
      if (originalDsn) process.env.SENTRY_DSN = originalDsn;
    });
  });

  describe('sentryRequestHandler', () => {
    it('should call next in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.resetModules();
      const { sentryRequestHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');

      const middleware = sentryRequestHandler();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should set request context in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { sentryRequestHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const middleware = sentryRequestHandler();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Sentry.setContext).toHaveBeenCalledWith('request', expect.objectContaining({
        method: 'GET',
        url: '/api/v1/test',
      }));
      expect(Sentry.setTag).toHaveBeenCalledWith('ip_address', '127.0.0.1');
      expect(mockNext).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sentryTracingHandler', () => {
    it('should call next in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.resetModules();
      const { sentryTracingHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');

      const middleware = sentryTracingHandler();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should start a span for the request in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { sentryTracingHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const middleware = sentryTracingHandler();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GET /api/v1/test',
          op: 'http.server',
        }),
        expect.any(Function)
      );
      expect(mockNext).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sentryErrorHandler', () => {
    it('should pass error to next in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      vi.resetModules();
      const { sentryErrorHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');

      const middleware = sentryErrorHandler();
      const error = new Error('Test error');
      middleware(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);

      process.env.NODE_ENV = originalEnv;
    });

    it('should capture 5xx errors in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { sentryErrorHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const middleware = sentryErrorHandler();
      const error = Object.assign(new Error('Server error'), { statusCode: 500 });
      middleware(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
      expect(mockNext).toHaveBeenCalledWith(error);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not capture 4xx errors', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { sentryErrorHandler } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const middleware = sentryErrorHandler();
      const error = Object.assign(new Error('Not found'), { statusCode: 404 });
      middleware(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Helper Functions', () => {
    it('should capture exception with context', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { captureException } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const error = new Error('Test error');
      captureException(error, { batchId: 'batch-123' });

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);

      process.env.NODE_ENV = originalEnv;
    });

    it('should capture message with level', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { captureMessage } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      captureMessage('Test warning', 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test warning', 'warning');

      process.env.NODE_ENV = originalEnv;
    });

    it('should set user context', async () => {
      const { setUser } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      setUser({ id: 'user-123', email: 'test@example.com', role: 'ADMIN' });

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      });
    });

    it('should clear user context', async () => {
      const { clearUser } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      clearUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    it('should add breadcrumb', async () => {
      const { addBreadcrumb } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      addBreadcrumb('Test action', 'user', { detail: 'value' }, 'info');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test action',
          category: 'user',
          data: { detail: 'value' },
          level: 'info',
        })
      );
    });
  });

  describe('Custom Instrumentation', () => {
    it('should instrument async operations', async () => {
      const { instrumentAsync } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const mockFn = vi.fn().mockResolvedValue('result');
      const result = await instrumentAsync('test-op', 'custom', mockFn);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-op',
          op: 'custom',
        }),
        expect.any(Function)
      );
      expect(result).toBe('result');
    });

    it('should instrument database queries', async () => {
      const { instrumentDbQuery } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const mockFn = vi.fn().mockResolvedValue([{ id: 1 }]);
      await instrumentDbQuery('SELECT * FROM batches', mockFn);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SELECT * FROM batches',
          op: 'db.query',
        }),
        expect.any(Function)
      );
    });

    it('should instrument HTTP requests', async () => {
      const { instrumentHttpRequest } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const mockFn = vi.fn().mockResolvedValue({ data: {} });
      await instrumentHttpRequest('https://api.example.com/data', 'GET', mockFn);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GET https://api.example.com/data',
          op: 'http.client',
        }),
        expect.any(Function)
      );
    });

    it('should instrument blockchain operations', async () => {
      const { instrumentBlockchain } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const mockFn = vi.fn().mockResolvedValue({ txHash: '0x123' });
      await instrumentBlockchain('recordBatch', mockFn);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'recordBatch',
          op: 'blockchain',
        }),
        expect.any(Function)
      );
    });

    it('should instrument IPFS operations', async () => {
      const { instrumentIpfs } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const mockFn = vi.fn().mockResolvedValue({ cid: 'Qm123' });
      await instrumentIpfs('uploadDocument', mockFn);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'uploadDocument',
          op: 'ipfs',
        }),
        expect.any(Function)
      );
    });

    it('should instrument PDF generation', async () => {
      const { instrumentPdf } = await import('../../../src/infrastructure/monitoring/sentry.js');
      const Sentry = await import('@sentry/node');

      const mockFn = vi.fn().mockResolvedValue(Buffer.from('pdf'));
      await instrumentPdf('generateCertificate', mockFn);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'generateCertificate',
          op: 'pdf.generate',
        }),
        expect.any(Function)
      );
    });
  });
});
