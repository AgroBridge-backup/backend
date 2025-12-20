import { User } from '../../domain/entities/User.js';
import * as Prisma from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      context?: {
        traceId: string;
        startTime: number;
      };
      user?: {
        userId: string;
        role: Prisma.UserRole;
        email: string;
        jti: string;
        exp: number;
        producerId?: string;
      };
      id?: string;
    }
  }
}