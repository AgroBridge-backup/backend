import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '@/shared/utils/logger';
import { AppError } from '@/shared/errors/AppError';
import { BatchNotFoundError } from '@/shared/errors/BatchNotFoundError';
import { ProducerNotWhitelistedError } from '@/shared/errors/ProducerNotWhitelistedError';
import { BlockchainTransactionError } from '@/shared/errors/BlockchainTransactionError';


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

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      requestId: req.id
    });
  }
  
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: err.errors,
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
