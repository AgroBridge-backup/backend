/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * Unit Tests for Certificate Domain Logic
 */

import { describe, it, expect } from 'vitest';
import {
  CertificateGrade,
  REQUIRED_STAGES_BY_GRADE,
  isCertificateValid,
  canUpgradeToGrade,
} from '../../../src/domain/entities/QualityCertificate.js';

describe('QualityCertificate Domain Entity', () => {
  describe('CertificateGrade', () => {
    it('should have all expected grades', () => {
      expect(CertificateGrade.STANDARD).toBe('STANDARD');
      expect(CertificateGrade.PREMIUM).toBe('PREMIUM');
      expect(CertificateGrade.EXPORT).toBe('EXPORT');
      expect(CertificateGrade.ORGANIC).toBe('ORGANIC');
    });
  });

  describe('REQUIRED_STAGES_BY_GRADE', () => {
    it('STANDARD requires HARVEST and PACKING', () => {
      expect(REQUIRED_STAGES_BY_GRADE[CertificateGrade.STANDARD]).toEqual([
        'HARVEST',
        'PACKING',
      ]);
    });

    it('PREMIUM requires HARVEST, PACKING, and COLD_CHAIN', () => {
      expect(REQUIRED_STAGES_BY_GRADE[CertificateGrade.PREMIUM]).toEqual([
        'HARVEST',
        'PACKING',
        'COLD_CHAIN',
      ]);
    });

    it('EXPORT requires all stages', () => {
      expect(REQUIRED_STAGES_BY_GRADE[CertificateGrade.EXPORT]).toEqual([
        'HARVEST',
        'PACKING',
        'COLD_CHAIN',
        'EXPORT',
        'DELIVERY',
      ]);
    });

    it('ORGANIC requires all stages (same as EXPORT)', () => {
      expect(REQUIRED_STAGES_BY_GRADE[CertificateGrade.ORGANIC]).toEqual([
        'HARVEST',
        'PACKING',
        'COLD_CHAIN',
        'EXPORT',
        'DELIVERY',
      ]);
    });
  });

  describe('isCertificateValid', () => {
    const now = new Date();

    it('returns true for a non-expired certificate', () => {
      const certificate = {
        id: 'cert-1',
        batchId: 'batch-1',
        grade: CertificateGrade.STANDARD,
        certifyingBody: 'Test Certifier',
        validFrom: new Date(now.getTime() - 86400000), // 1 day ago
        validTo: new Date(now.getTime() + 86400000), // 1 day from now
        hashOnChain: 'abc123',
        issuedAt: new Date(),
        issuedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isCertificateValid(certificate)).toBe(true);
    });

    it('returns false for an expired certificate', () => {
      const certificate = {
        id: 'cert-1',
        batchId: 'batch-1',
        grade: CertificateGrade.STANDARD,
        certifyingBody: 'Test Certifier',
        validFrom: new Date(now.getTime() - 86400000 * 2), // 2 days ago
        validTo: new Date(now.getTime() - 86400000), // 1 day ago (expired)
        hashOnChain: 'abc123',
        issuedAt: new Date(),
        issuedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isCertificateValid(certificate)).toBe(false);
    });

    it('returns false for a certificate not yet valid', () => {
      const certificate = {
        id: 'cert-1',
        batchId: 'batch-1',
        grade: CertificateGrade.STANDARD,
        certifyingBody: 'Test Certifier',
        validFrom: new Date(now.getTime() + 86400000), // 1 day from now
        validTo: new Date(now.getTime() + 86400000 * 2), // 2 days from now
        hashOnChain: 'abc123',
        issuedAt: new Date(),
        issuedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isCertificateValid(certificate)).toBe(false);
    });
  });

  describe('canUpgradeToGrade', () => {
    it('can upgrade from STANDARD to PREMIUM', () => {
      expect(canUpgradeToGrade(CertificateGrade.STANDARD, CertificateGrade.PREMIUM)).toBe(true);
    });

    it('can upgrade from STANDARD to EXPORT', () => {
      expect(canUpgradeToGrade(CertificateGrade.STANDARD, CertificateGrade.EXPORT)).toBe(true);
    });

    it('can upgrade from PREMIUM to EXPORT', () => {
      expect(canUpgradeToGrade(CertificateGrade.PREMIUM, CertificateGrade.EXPORT)).toBe(true);
    });

    it('cannot downgrade from EXPORT to PREMIUM', () => {
      expect(canUpgradeToGrade(CertificateGrade.EXPORT, CertificateGrade.PREMIUM)).toBe(false);
    });

    it('cannot downgrade from PREMIUM to STANDARD', () => {
      expect(canUpgradeToGrade(CertificateGrade.PREMIUM, CertificateGrade.STANDARD)).toBe(false);
    });

    it('cannot upgrade to same grade', () => {
      expect(canUpgradeToGrade(CertificateGrade.STANDARD, CertificateGrade.STANDARD)).toBe(false);
    });
  });
});
