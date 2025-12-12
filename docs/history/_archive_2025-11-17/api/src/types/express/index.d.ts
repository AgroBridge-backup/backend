import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        userId: string;
        role: UserRole;
        email: string;
      };
      id?: string;
    }
  }
}
