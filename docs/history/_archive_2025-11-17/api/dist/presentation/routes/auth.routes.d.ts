import { Router } from 'express';
import { LoginUseCase } from '@/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '@/application/use-cases/auth/RefreshTokenUseCase';
import { LogoutUseCase } from '@/application/use-cases/auth/LogoutUseCase';
import { GetCurrentUserUseCase } from '@/application/use-cases/auth/GetCurrentUserUseCase';
export declare function createAuthRouter(useCases: {
    loginUseCase: LoginUseCase;
    refreshTokenUseCase: RefreshTokenUseCase;
    logoutUseCase: LogoutUseCase;
    getCurrentUserUseCase: GetCurrentUserUseCase;
}): Router;
//# sourceMappingURL=auth.routes.d.ts.map