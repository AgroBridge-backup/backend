import * as Prisma from '@prisma/client';

export interface User {
  id: string;
  email: string;
  passwordHash: string | null; // Nullable for OAuth-only users
  role: Prisma.UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  walletAddress?: string | null;
  // Two-Factor Authentication
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  backupCodes?: string[];
  twoFactorEnabledAt?: Date | null;
  producer?: {
    id: string;
    businessName: string;
    rfc: string;
  } | null;
}