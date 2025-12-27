/**
 * Express Request Type Augmentation
 * Provides type-safe access to authenticated user properties
 */
import { UserRole } from "@prisma/client";

// Make this a module so declare global works
export {};

declare global {
  namespace Express {
    interface Request {
      context?: {
        traceId: string;
        startTime: number;
      };
      user?: {
        // Core auth properties
        userId: string;
        id?: string; // Alias for userId (some routes use this)
        email: string;
        role: UserRole;
        jti: string;
        exp: number;

        // Producer properties
        producerId?: string;

        // Export company properties
        exportCompanyId?: string;
        exportCompanyAdminId?: string;
        companyId?: string;

        // User profile
        firstName?: string;
        lastName?: string;
      };
      id?: string;
      requestId?: string;
    }
  }
}
