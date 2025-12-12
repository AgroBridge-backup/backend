import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: UserRole;
        email: string;
        jti: string;
        exp: number;
    };
}
export declare const authenticate: (requiredRoles?: UserRole[]) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map