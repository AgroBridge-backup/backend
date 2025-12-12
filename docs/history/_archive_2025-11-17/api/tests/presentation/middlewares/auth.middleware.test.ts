import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisClient } from '@/infrastructure/cache/RedisClient';
import { authenticate, AuthenticatedRequest } from '@/presentation/middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { InvalidTokenError } from '@/shared/errors/InvalidTokenError';
import { TokenExpiredError as CustomTokenExpiredError } from '@/shared/errors/TokenExpiredError';
import { InsufficientPermissionsError } from '@/shared/errors/InsufficientPermissionsError';

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('@/infrastructure/cache/RedisClient');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = vi.fn();

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    nextFunction = vi.fn();
    vi.resetAllMocks();
  });

  const mockJwtPayload = {
    jti: 'mock-jwt-id',
    sub: 'mock-user-id',
    role: UserRole.PRODUCER,
    email: 'producer@test.com',
  };

  it('should call next with InvalidTokenError if auth header is missing', async () => {
    const middleware = authenticate();
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith(expect.any(InvalidTokenError));
    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authorization header missing or malformed' }));
  });

  it('should call next with InvalidTokenError if token is not Bearer', async () => {
    mockRequest.headers = { authorization: 'Basic some-token' };
    const middleware = authenticate();
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith(expect.any(InvalidTokenError));
    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authorization header missing or malformed' }));
  });

  it('should call next with InvalidTokenError if token is blacklisted', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    vi.mocked(jwt.verify).mockReturnValue(mockJwtPayload as any);
    vi.mocked(redisClient.isBlacklisted).mockResolvedValue(true);

    const middleware = authenticate();
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(redisClient.isBlacklisted).toHaveBeenCalledWith(mockJwtPayload.jti);
    expect(nextFunction).toHaveBeenCalledWith(expect.any(InvalidTokenError));
    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token has been revoked' }));
  });

  it('should call next with CustomTokenExpiredError if jwt.verify throws TokenExpiredError', async () => {
    mockRequest.headers = { authorization: 'Bearer expired-token' };
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new jwt.TokenExpiredError('jwt expired', new Date());
    });

    const middleware = authenticate();
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith(expect.any(CustomTokenExpiredError));
  });

  it('should call next with InvalidTokenError if jwt.verify throws a generic error', async () => {
    mockRequest.headers = { authorization: 'Bearer invalid-signature-token' };
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const middleware = authenticate();
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith(expect.any(InvalidTokenError));
    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token verification failed' }));
  });

  it('should call next with InsufficientPermissionsError if user role is not in required roles', async () => {
    mockRequest.headers = { authorization: 'Bearer producer-token' };
    vi.mocked(jwt.verify).mockReturnValue(mockJwtPayload as any); // User is a PRODUCER
    vi.mocked(redisClient.isBlacklisted).mockResolvedValue(false);

    // Require ADMIN role
    const middleware = authenticate([UserRole.ADMIN]);
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.any(InsufficientPermissionsError));
  });

  it('should attach user to request and call next if token is valid and role is sufficient', async () => {
    mockRequest.headers = { authorization: 'Bearer admin-token' };
    const adminPayload = { ...mockJwtPayload, role: UserRole.ADMIN };
    vi.mocked(jwt.verify).mockReturnValue(adminPayload as any);
    vi.mocked(redisClient.isBlacklisted).mockResolvedValue(false);
    vi.mocked(redisClient.checkRateLimit).mockResolvedValue(true);

    const middleware = authenticate([UserRole.ADMIN]);
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe(adminPayload.sub);
    expect(mockRequest.user?.role).toBe(UserRole.ADMIN);
    expect(nextFunction).toHaveBeenCalledWith(); // Called with no arguments
  });

  it('should succeed if no roles are required and token is valid', async () => {
    mockRequest.headers = { authorization: 'Bearer any-role-token' };
    vi.mocked(jwt.verify).mockReturnValue(mockJwtPayload as any);
    vi.mocked(redisClient.isBlacklisted).mockResolvedValue(false);
    vi.mocked(redisClient.checkRateLimit).mockResolvedValue(true);

    const middleware = authenticate(); // No roles required
    await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

    expect(mockRequest.user).toBeDefined();
    expect(nextFunction).toHaveBeenCalledWith();
  });
});
