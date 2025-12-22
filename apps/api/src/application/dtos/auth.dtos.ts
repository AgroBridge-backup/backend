import * as Prisma from '@prisma/client';

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken?: string;
  refreshToken?: string;
  requires2FA?: boolean;
  tempToken?: string;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfileDto {
  userId: string;
  email: string;
  role: Prisma.UserRole;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TWO-FACTOR AUTHENTICATION DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export interface Setup2FARequestDto {
  userId: string;
}

export interface Setup2FAResponseDto {
  secret: string;
  otpauthUrl: string;
  qrCode: string;
}

export interface Enable2FARequestDto {
  userId: string;
  token: string;
}

export interface Enable2FAResponseDto {
  enabled: boolean;
  backupCodes: string[];
}

export interface Disable2FARequestDto {
  userId: string;
  token: string;
}

export interface Verify2FARequestDto {
  tempToken: string;
  token: string;
}

export interface Verify2FAResponseDto {
  accessToken: string;
  refreshToken: string;
}

export interface TwoFactorStatusDto {
  enabled: boolean;
  enabledAt: Date | null;
  backupCodesRemaining: number;
}

export interface RegenerateBackupCodesRequestDto {
  userId: string;
  token: string;
}

export interface RegenerateBackupCodesResponseDto {
  backupCodes: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegisterRequestDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  rfc?: string;
  state?: string;
  municipality?: string;
}

export interface RegisterResponseDto {
  userId: string;
  email: string;
  message: string;
}