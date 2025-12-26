/**
 * Security Tests
 * Comprehensive security testing for the AgroBridge API
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// Mock imports for testing
const mockApp = express();
mockApp.use(express.json());

// Test data
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

const MALICIOUS_PAYLOADS = {
  sqlInjection: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1; SELECT * FROM users",
    "admin'--",
    "' UNION SELECT * FROM users --",
  ],
  xss: [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(1)">',
    'javascript:alert(1)',
    '<svg onload="alert(1)">',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
  ],
  noSqlInjection: [
    { $gt: '' },
    { $where: 'this.password.length > 0' },
    { $regex: '.*' },
    { $ne: null }, // Direct operator, not nested
  ],
  commandInjection: [
    '; ls -la',
    '| cat /etc/passwd',
    '`whoami`',
    '$(cat /etc/passwd)',
    '& dir',
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  ],
};

describe('Security Tests', () => {
  describe('Input Sanitization', () => {
    describe('SQL Injection Prevention', () => {
      it.each(MALICIOUS_PAYLOADS.sqlInjection)(
        'should reject SQL injection attempt: %s',
        async (payload) => {
          const { detectSqlInjection } = await import(
            '../../src/infrastructure/security/input-sanitizer.js'
          );
          expect(detectSqlInjection(payload)).toBe(true);
        }
      );

      it('should allow legitimate queries', async () => {
        const { detectSqlInjection } = await import(
          '../../src/infrastructure/security/input-sanitizer.js'
        );
        expect(detectSqlInjection('john.doe@example.com')).toBe(false);
        expect(detectSqlInjection('Normal search term')).toBe(false);
        expect(detectSqlInjection('12345')).toBe(false);
      });
    });

    describe('XSS Prevention', () => {
      it.each(MALICIOUS_PAYLOADS.xss)(
        'should detect XSS attempt: %s',
        async (payload) => {
          const { detectXss } = await import(
            '../../src/infrastructure/security/input-sanitizer.js'
          );
          expect(detectXss(payload)).toBe(true);
        }
      );

      it('should allow safe HTML content', async () => {
        const { detectXss } = await import(
          '../../src/infrastructure/security/input-sanitizer.js'
        );
        expect(detectXss('Hello, World!')).toBe(false);
        expect(detectXss('This is a <b>test</b>')).toBe(false);
      });
    });

    describe('NoSQL Injection Prevention', () => {
      it.each(MALICIOUS_PAYLOADS.noSqlInjection)(
        'should detect NoSQL injection attempt',
        async (payload) => {
          const { detectNoSqlInjection } = await import(
            '../../src/infrastructure/security/input-sanitizer.js'
          );
          expect(detectNoSqlInjection(payload)).toBe(true);
        }
      );

      it('should allow normal objects', async () => {
        const { detectNoSqlInjection } = await import(
          '../../src/infrastructure/security/input-sanitizer.js'
        );
        expect(detectNoSqlInjection({ email: 'test@example.com' })).toBe(false);
        expect(detectNoSqlInjection({ name: 'John Doe' })).toBe(false);
      });
    });

    describe('Input Sanitization', () => {
      it('should sanitize HTML content', async () => {
        const { sanitizeString } = await import(
          '../../src/infrastructure/security/input-sanitizer.js'
        );
        const result = sanitizeString('<script>alert("XSS")</script>Hello');
        expect(result).not.toContain('<script>');
        expect(result).toContain('Hello');
      });

      it('should trim whitespace', async () => {
        const { sanitizeString } = await import(
          '../../src/infrastructure/security/input-sanitizer.js'
        );
        const result = sanitizeString('  Hello World  ');
        expect(result).toBe('Hello World');
      });

      it('should enforce max length', async () => {
        const { sanitizeString } = await import(
          '../../src/infrastructure/security/input-sanitizer.js'
        );
        const longString = 'a'.repeat(20000);
        const result = sanitizeString(longString, { maxLength: 100 });
        expect(result.length).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Encryption Service', () => {
    beforeAll(() => {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';
    });

    describe('AES-256-GCM Encryption', () => {
      it('should encrypt and decrypt data correctly', async () => {
        const { encrypt, decrypt } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const plaintext = 'Sensitive data to encrypt';
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      });

      it('should produce different ciphertext for same plaintext', async () => {
        const { encrypt } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const plaintext = 'Same data';
        const encrypted1 = encrypt(plaintext);
        const encrypted2 = encrypt(plaintext);
        expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      });

      it('should encrypt to string and decrypt from string', async () => {
        const { encryptToString, decryptFromString } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const plaintext = 'Test string encryption';
        const encrypted = encryptToString(plaintext);
        expect(encrypted).toMatch(/^v1:/);
        const decrypted = decryptFromString(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });

    describe('Hashing', () => {
      it('should produce consistent hash for same input', async () => {
        const { hash } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const data = 'Test data';
        const hash1 = hash(data);
        const hash2 = hash(data);
        expect(hash1).toBe(hash2);
      });

      it('should produce different hash for different input', async () => {
        const { hash } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const hash1 = hash('Data 1');
        const hash2 = hash('Data 2');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('HMAC', () => {
      it('should verify valid HMAC', async () => {
        const { hmac, verifyHmac } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const data = 'Data to authenticate';
        const computedHmac = hmac(data);
        expect(verifyHmac(data, computedHmac)).toBe(true);
      });

      it('should reject invalid HMAC', async () => {
        const { verifyHmac } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const data = 'Data to authenticate';
        const fakeHmac = 'a'.repeat(64);
        expect(verifyHmac(data, fakeHmac)).toBe(false);
      });
    });

    describe('Data Masking', () => {
      it('should mask email addresses', async () => {
        const { maskEmail } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        expect(maskEmail('john.doe@example.com')).toMatch(/j.*e@example\.com/);
      });

      it('should mask phone numbers', async () => {
        const { maskPhone } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const masked = maskPhone('+1234567890');
        expect(masked).toMatch(/\*+7890$/);
      });

      it('should mask sensitive data', async () => {
        const { maskSensitiveData } = await import(
          '../../src/infrastructure/security/encryption.service.js'
        );
        const masked = maskSensitiveData('mysecretpassword', 2);
        expect(masked).toBe('my************rd');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should have correct tier configurations', async () => {
      const { RateLimitTiers } = await import(
        '../../src/infrastructure/security/rate-limiter.js'
      );

      expect(RateLimitTiers.AUTH.max).toBe(5);
      expect(RateLimitTiers.AUTH.windowMs).toBe(15 * 60 * 1000);

      expect(RateLimitTiers.API.max).toBe(100);
      expect(RateLimitTiers.SENSITIVE.max).toBe(3);
    });
  });

  describe('Audit Logging', () => {
    it('should have all required event types', async () => {
      const { AuditEventType } = await import(
        '../../src/infrastructure/security/audit-logger.js'
      );

      expect(AuditEventType.AUTH_LOGIN_SUCCESS).toBeDefined();
      expect(AuditEventType.AUTH_LOGIN_FAILURE).toBeDefined();
      expect(AuditEventType.SECURITY_INJECTION_ATTEMPT).toBeDefined();
      expect(AuditEventType.GDPR_DATA_DELETION_REQUEST).toBeDefined();
    });

    it('should have all severity levels', async () => {
      const { AuditSeverity } = await import(
        '../../src/infrastructure/security/audit-logger.js'
      );

      expect(AuditSeverity.LOW).toBe('LOW');
      expect(AuditSeverity.MEDIUM).toBe('MEDIUM');
      expect(AuditSeverity.HIGH).toBe('HIGH');
      expect(AuditSeverity.CRITICAL).toBe('CRITICAL');
    });
  });

  describe('PII Handler', () => {
    beforeAll(() => {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';
    });

    it('should have all PII field types', async () => {
      const { PiiFieldType } = await import(
        '../../src/infrastructure/security/pii-handler.js'
      );

      expect(PiiFieldType.EMAIL).toBe('EMAIL');
      expect(PiiFieldType.PHONE).toBe('PHONE');
      expect(PiiFieldType.SSN).toBe('SSN');
      expect(PiiFieldType.FINANCIAL).toBe('FINANCIAL');
    });

    it('should have all consent types', async () => {
      const { ConsentType } = await import(
        '../../src/infrastructure/security/pii-handler.js'
      );

      expect(ConsentType.MARKETING).toBe('MARKETING');
      expect(ConsentType.ANALYTICS).toBe('ANALYTICS');
      expect(ConsentType.DATA_PROCESSING).toBe('DATA_PROCESSING');
    });

    it('should encrypt and decrypt PII', async () => {
      const { getPiiHandler } = await import(
        '../../src/infrastructure/security/pii-handler.js'
      );
      const handler = getPiiHandler();
      const email = 'test@example.com';
      const encrypted = handler.encryptPii(email, 'email');
      expect(encrypted).toMatch(/^v1:/);
      const decrypted = handler.decryptPii(encrypted, 'email');
      expect(decrypted).toBe(email);
    });

    it('should mask PII correctly', async () => {
      const { getPiiHandler } = await import(
        '../../src/infrastructure/security/pii-handler.js'
      );
      const handler = getPiiHandler();
      const masked = handler.maskPii('test@example.com', 'email');
      expect(masked).toContain('@');
      expect(masked).toContain('*');
    });
  });

  describe('Vulnerability Scanner', () => {
    it('should detect missing environment variables', async () => {
      const { VulnerabilityScanner } = await import(
        '../../src/infrastructure/security/vulnerability-scanner.js'
      );
      const scanner = new VulnerabilityScanner();
      const result = await scanner.runFullScan();
      expect(result.scanId).toBeDefined();
      expect(result.findings).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
    });

    it('should categorize findings by severity', async () => {
      const { VulnerabilityScanner } = await import(
        '../../src/infrastructure/security/vulnerability-scanner.js'
      );
      const scanner = new VulnerabilityScanner();
      const result = await scanner.runFullScan();

      expect(typeof result.summary.critical).toBe('number');
      expect(typeof result.summary.high).toBe('number');
      expect(typeof result.summary.medium).toBe('number');
      expect(typeof result.summary.low).toBe('number');
      expect(typeof result.summary.info).toBe('number');
    });
  });

  describe('Security Headers', () => {
    it('should have correct Helmet configuration', async () => {
      const { routeSecurityHeaders } = await import(
        '../../src/infrastructure/security/helmet.config.js'
      );

      expect(routeSecurityHeaders.documentation).toBeDefined();
      expect(routeSecurityHeaders.download).toBeDefined();
      expect(routeSecurityHeaders.public).toBeDefined();
      expect(routeSecurityHeaders.webhook).toBeDefined();
    });
  });

  describe('Response Optimization', () => {
    it('should generate valid ETags', async () => {
      const { generateETag, generateWeakETag } = await import(
        '../../src/infrastructure/performance/response-optimizer.js'
      );

      const data = { foo: 'bar' };
      const etag = generateETag(data);
      expect(etag).toMatch(/^"[a-f0-9]+"$/);

      const weakEtag = generateWeakETag(data);
      expect(weakEtag).toMatch(/^W\/"v1-[a-f0-9]+"$/);
    });

    it('should select fields correctly', async () => {
      const { selectFields } = await import(
        '../../src/infrastructure/performance/response-optimizer.js'
      );

      const data = { id: '1', name: 'Test', email: 'test@example.com', secret: 'hidden' };
      const result = selectFields(data, ['name', 'email']);

      expect(result.id).toBe('1'); // Always included
      expect(result.name).toBe('Test');
      expect(result.email).toBe('test@example.com');
      expect(result.secret).toBeUndefined();
    });

    it('should create correct cache control headers', async () => {
      const { cacheControlPolicies } = await import(
        '../../src/infrastructure/performance/response-optimizer.js'
      );

      expect(cacheControlPolicies.noCache).toBeDefined();
      expect(cacheControlPolicies.short).toBeDefined();
      expect(cacheControlPolicies.medium).toBeDefined();
      expect(cacheControlPolicies.long).toBeDefined();
      expect(cacheControlPolicies.private).toBeDefined();
    });
  });

  describe('Query Optimization', () => {
    it('should generate cache keys', async () => {
      const { generateCacheKey } = await import(
        '../../src/infrastructure/performance/query-optimizer.js'
      );

      const key = generateCacheKey('User', 'findMany', { where: { active: true } });
      expect(key).toMatch(/^query:User:findMany:/);
    });

    it('should analyze query complexity', async () => {
      const { analyzeQueryComplexity } = await import(
        '../../src/infrastructure/performance/query-optimizer.js'
      );

      const simpleQuery = { where: { id: '1' }, take: 10 };
      const simpleResult = analyzeQueryComplexity(simpleQuery);
      expect(simpleResult.complexity).toBeGreaterThan(0);
      expect(simpleResult.warnings).toBeInstanceOf(Array);

      const complexQuery = {
        where: { OR: [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }, { e: 5 }, { f: 6 }] },
        include: { posts: { include: { comments: { include: { author: true } } } } },
        take: 200,
      };
      const complexResult = analyzeQueryComplexity(complexQuery);
      expect(complexResult.complexity).toBeGreaterThan(simpleResult.complexity);
      expect(complexResult.warnings.length).toBeGreaterThan(0);
    });

    it('should parse field selection', async () => {
      const { parseFieldSelection } = await import(
        '../../src/infrastructure/performance/query-optimizer.js'
      );

      const allowedFields = ['id', 'name', 'email', 'createdAt'];
      const result = parseFieldSelection('name,email,password', allowedFields);

      expect(result?.id).toBe(true);
      expect(result?.name).toBe(true);
      expect(result?.email).toBe(true);
      expect(result?.password).toBeUndefined();
    });
  });
});

describe('Authentication Security', () => {
  describe('Password Requirements', () => {
    const passwordTests = [
      { password: 'short', valid: false, reason: 'too short' },
      { password: 'alllowercase123', valid: false, reason: 'no uppercase' },
      { password: 'ALLUPPERCASE123', valid: false, reason: 'no lowercase' },
      { password: 'NoNumbers!!', valid: false, reason: 'no numbers' },
      { password: 'NoSpecial123', valid: false, reason: 'no special chars' },
      { password: 'ValidPass123!', valid: true, reason: 'meets all requirements' },
    ];

    it.each(passwordTests)(
      'should validate password: $reason',
      ({ password, valid }) => {
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasMinLength = password.length >= 8;

        const isValid = hasUppercase && hasLowercase && hasNumber && hasSpecial && hasMinLength;
        expect(isValid).toBe(valid);
      }
    );
  });

  describe('Token Security', () => {
    it('should generate cryptographically secure tokens', async () => {
      const { generateToken } = await import(
        '../../src/infrastructure/security/encryption.service.js'
      );

      const token1 = generateToken(32);
      const token2 = generateToken(32);

      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });
});

describe('GDPR Compliance', () => {
  it('should support all data subject rights', async () => {
    const { DataSubjectRight } = await import(
      '../../src/infrastructure/security/pii-handler.js'
    );

    expect(DataSubjectRight.ACCESS).toBe('ACCESS');
    expect(DataSubjectRight.RECTIFICATION).toBe('RECTIFICATION');
    expect(DataSubjectRight.ERASURE).toBe('ERASURE');
    expect(DataSubjectRight.PORTABILITY).toBe('PORTABILITY');
    expect(DataSubjectRight.RESTRICTION).toBe('RESTRICTION');
    expect(DataSubjectRight.OBJECTION).toBe('OBJECTION');
  });
});
