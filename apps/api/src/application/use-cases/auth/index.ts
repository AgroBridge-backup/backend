// FIX 2025: Barrel file corrected by QA Architect to ensure proper module exports.
// This file aggregates and exports all use cases for this module, fixing 'is not a constructor' TypeErrors.
export * from './GetCurrentUserUseCase.js';
export * from './LoginUseCase.js';
export * from './LogoutUseCase.js';
export * from './RefreshTokenUseCase.js';

// A type to group all auth use cases for dependency injection
import { GetCurrentUserUseCase } from './GetCurrentUserUseCase.js';
import { LoginUseCase } from './LoginUseCase.js';
import { LogoutUseCase } from './LogoutUseCase.js';
import { RefreshTokenUseCase } from './RefreshTokenUseCase.js';

export type AuthUseCases = {
  getCurrentUserUseCase: GetCurrentUserUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
};