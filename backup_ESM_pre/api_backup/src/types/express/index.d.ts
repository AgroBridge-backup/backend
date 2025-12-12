import * as Prisma from '@prisma/client';

// This declaration file augments the global Express namespace.
// It adds a 'user' property to the Express.Request interface,
// ensuring that TypeScript recognizes the property attached by our auth middleware.
// This resolves all TS2769 ("No overload matches this call") errors in route handlers.
declare namespace Express {
  export interface Request {
    user?: {
      userId: string;
      role: Prisma.UserRole;
      jti: string;
      exp: number;
    };
    id?: string;
  }
}
