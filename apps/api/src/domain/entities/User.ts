import * as Prisma from '@prisma/client';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Prisma.UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}