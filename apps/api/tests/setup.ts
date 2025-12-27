// ============================================================================
// AgroBridge API - Test Suite Setup
// ============================================================================
// This file runs before all tests to configure the test environment
// Ensures test database isolation and proper mock configuration
// ============================================================================

import { config } from 'dotenv';
import { resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// LOAD TEST ENVIRONMENT (Must be first!)
// ─────────────────────────────────────────────────────────────────────────────

// Force load .env.test with override to ensure test environment
config({ path: resolve(__dirname, '../.env.test'), override: true });

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

// Critical: Verify we're using test database
const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl.includes('_test') && !databaseUrl.includes('test')) {
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('CRITICAL ERROR: Not using test database!');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('Current DATABASE_URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'));
  console.error('');
  console.error('Tests MUST run against a test database to prevent data loss.');
  console.error('Ensure .env.test exists and contains a test database URL.');
  console.error('═══════════════════════════════════════════════════════════════');
  process.exit(1);
}

// Verify NODE_ENV is test
if (process.env.NODE_ENV !== 'test') {
  console.warn('Warning: NODE_ENV is not "test". Setting to "test".');
  process.env.NODE_ENV = 'test';
}

// Log test environment info (only in verbose mode)
if (process.env.VERBOSE_TESTS === 'true') {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Test Environment Loaded');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Database:', databaseUrl.split('@')[1]?.split('?')[0] || 'configured');
  console.log('Redis:', process.env.REDIS_URL || 'not configured');
  console.log('═══════════════════════════════════════════════════════════════');
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL TEST CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

// Increase default timeout for async operations
// Some tests involve database operations that may take longer
import { vi } from 'vitest';

// Set default timezone for consistent date handling
process.env.TZ = 'UTC';

// Suppress console output in tests unless debugging
if (process.env.DEBUG_TESTS !== 'true') {
  // Keep console.error for actual errors
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS FOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

export const testConfig = {
  databaseUrl,
  isTestEnvironment: true,
  nodeEnv: process.env.NODE_ENV,
};
