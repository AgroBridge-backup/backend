import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../../shared/utils/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { BatchNotFoundError } from '../../shared/errors/BatchNotFoundError.js';
import { ProducerNotWhitelistedError } from '../../shared/errors/ProducerNotWhitelistedError.js';
import { BlockchainTransactionError } from '../../shared/errors/BlockchainTransactionError.js';
import { InvalidTokenError } from '../../shared/errors/InvalidTokenError.js';
import { AuthenticationError } from '../../shared/errors/AuthenticationError.js';


export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });

  // Explicit checks for specific errors just in case instanceof AppError fails due to prototype issues
  if (
    err instanceof InvalidTokenError || 
    err instanceof AuthenticationError ||
    err.name === 'InvalidTokenError' ||
    err.name === 'AuthenticationError'
  ) {
     return res.status(401).json({
      error: err.name,
      message: err.message,
      requestId: req.id
    });
  }

  if (err instanceof AppError) {
    const appError = err as AppError;
    return res.status(appError.statusCode).json({
      error: appError.name,
      message: appError.message,
      requestId: req.id
    });
  }
  
  if (err instanceof ZodError) {
    const zodError = err as ZodError;
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: zodError.errors,
      requestId: req.id
    });
  }


  // Specific error mapping from prompt
  if (err instanceof BatchNotFoundError) {
    return res.status(404).json({
      error: 'BATCH_NOT_FOUND',
      message: err.message,
      requestId: req.id
    });
  }
  
  if (err instanceof ProducerNotWhitelistedError) {
    return res.status(403).json({
      error: 'PRODUCER_NOT_WHITELISTED',
      message: 'Producer must be whitelisted before creating batches',
      requestId: req.id
    });
  }

  if (err instanceof BlockchainTransactionError) {
    return res.status(503).json({
      error: 'BLOCKCHAIN_UNAVAILABLE',
      message: 'Blockchain network temporarily unavailable',
      retryAfter: 30,
      requestId: req.id
    });
  }

  // Default 500
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    requestId: req.id
  });
};
