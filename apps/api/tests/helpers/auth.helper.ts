/**
 * Authentication Test Helpers
 *
 * Provides utilities for generating test JWT tokens and managing
 * test user authentication in integration tests.
 */

import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

// Test JWT secret - used in test environment only
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-integration-tests';

export interface TestTokenPayload {
  userId: string;
  email: string;
  role: UserRole | string;
  producerId?: string;
  exportCompanyAdminId?: string;
  tenantId?: string;
}

/**
 * Generate a test JWT token for integration tests
 */
export function generateTestToken(payload: Partial<TestTokenPayload>): string {
  const defaultPayload: TestTokenPayload = {
    userId: payload.userId || 'test-user-' + Date.now(),
    email: payload.email || 'test@agrobridge.io',
    role: payload.role || 'ADMIN',
    producerId: payload.producerId,
    exportCompanyAdminId: payload.exportCompanyAdminId,
    tenantId: payload.tenantId || 'test-tenant',
  };

  return jwt.sign(
    {
      sub: defaultPayload.userId,
      userId: defaultPayload.userId,
      email: defaultPayload.email,
      role: defaultPayload.role,
      ...(defaultPayload.producerId && { producerId: defaultPayload.producerId }),
      ...(defaultPayload.exportCompanyAdminId && { exportCompanyAdminId: defaultPayload.exportCompanyAdminId }),
      tenantId: defaultPayload.tenantId,
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Generate an admin test token
 */
export function generateAdminToken(userId?: string): string {
  return generateTestToken({
    userId: userId || 'admin-' + Date.now(),
    email: 'admin@agrobridge.io',
    role: 'ADMIN',
  });
}

/**
 * Generate a producer test token
 */
export function generateProducerToken(producerId: string, userId?: string): string {
  return generateTestToken({
    userId: userId || 'producer-user-' + Date.now(),
    email: 'producer@agrobridge.io',
    role: 'PRODUCER',
    producerId,
  });
}

/**
 * Generate an export company admin test token
 */
export function generateExportCompanyAdminToken(exportCompanyId: string, userId?: string): string {
  return generateTestToken({
    userId: userId || 'export-admin-' + Date.now(),
    email: 'exportadmin@agrobridge.io',
    role: 'EXPORT_COMPANY_ADMIN',
    exportCompanyAdminId: exportCompanyId,
  });
}

/**
 * Generate a certifier test token
 */
export function generateCertifierToken(userId?: string): string {
  return generateTestToken({
    userId: userId || 'certifier-' + Date.now(),
    email: 'certifier@agrobridge.io',
    role: 'CERTIFIER',
  });
}

/**
 * Decode a test token (for verification in tests)
 */
export function decodeTestToken(token: string): TestTokenPayload | null {
  try {
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
    return {
      userId: decoded.sub || decoded.userId,
      email: decoded.email,
      role: decoded.role,
      producerId: decoded.producerId,
      exportCompanyAdminId: decoded.exportCompanyAdminId,
      tenantId: decoded.tenantId,
    };
  } catch {
    return null;
  }
}
