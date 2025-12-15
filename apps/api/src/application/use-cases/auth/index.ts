// FIX 2025: Barrel file corrected by QA Architect to ensure proper module exports.
// This file aggregates and exports all use cases for this module, fixing 'is not a constructor' TypeErrors.
export * from './GetCurrentUserUseCase.js';
export * from './LoginUseCase.js';
export * from './LogoutUseCase.js';
export * from './RefreshTokenUseCase.js';

// Two-Factor Authentication Use Cases
export * from './Setup2FAUseCase.js';
export * from './Enable2FAUseCase.js';
export * from './Disable2FAUseCase.js';
export * from './Verify2FAUseCase.js';
export * from './Get2FAStatusUseCase.js';
export * from './RegenerateBackupCodesUseCase.js';

// A type to group all auth use cases for dependency injection
import { GetCurrentUserUseCase } from './GetCurrentUserUseCase.js';
import { LoginUseCase } from './LoginUseCase.js';
import { LogoutUseCase } from './LogoutUseCase.js';
import { RefreshTokenUseCase } from './RefreshTokenUseCase.js';
import { Setup2FAUseCase } from './Setup2FAUseCase.js';
import { Enable2FAUseCase } from './Enable2FAUseCase.js';
import { Disable2FAUseCase } from './Disable2FAUseCase.js';
import { Verify2FAUseCase } from './Verify2FAUseCase.js';
import { Get2FAStatusUseCase } from './Get2FAStatusUseCase.js';
import { RegenerateBackupCodesUseCase } from './RegenerateBackupCodesUseCase.js';

export type AuthUseCases = {
  getCurrentUserUseCase: GetCurrentUserUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
};

export type TwoFactorUseCases = {
  setup2FAUseCase: Setup2FAUseCase;
  enable2FAUseCase: Enable2FAUseCase;
  disable2FAUseCase: Disable2FAUseCase;
  verify2FAUseCase: Verify2FAUseCase;
  get2FAStatusUseCase: Get2FAStatusUseCase;
  regenerateBackupCodesUseCase: RegenerateBackupCodesUseCase;
};