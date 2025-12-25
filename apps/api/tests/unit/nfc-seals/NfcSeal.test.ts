/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Unit Tests for NFC Seal Domain Logic
 */

import { describe, it, expect } from 'vitest';
import {
  NfcSeal,
  NfcSealVerification,
  NfcSealStatus,
  TamperIndicator,
  generateSealKeyPair,
  generateChallenge,
  signChallenge,
  verifySignature,
  encryptPrivateKey,
  decryptPrivateKey,
  canAttachSeal,
  canVerifySeal,
  canRemoveSeal,
  isSealExpired,
  detectCounterAnomaly,
  isValidSerialNumber,
  calculateIntegrityScore,
  NFC_SEAL_STATUS_INFO,
  TAMPER_INDICATOR_INFO,
} from '../../../src/domain/entities/NfcSeal.js';

describe('NfcSeal Domain Logic', () => {
  describe('generateSealKeyPair', () => {
    it('should generate valid EC keypair', () => {
      const { publicKey, privateKey } = generateSealKeyPair();

      expect(publicKey).toBeDefined();
      expect(privateKey).toBeDefined();
      expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    it('should generate unique keypairs', () => {
      const pair1 = generateSealKeyPair();
      const pair2 = generateSealKeyPair();

      expect(pair1.publicKey).not.toBe(pair2.publicKey);
      expect(pair1.privateKey).not.toBe(pair2.privateKey);
    });
  });

  describe('generateChallenge', () => {
    it('should generate 64-character hex string', () => {
      const challenge = generateChallenge();

      expect(challenge).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(challenge)).toBe(true);
    });

    it('should generate unique challenges', () => {
      const challenge1 = generateChallenge();
      const challenge2 = generateChallenge();

      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('signChallenge and verifySignature', () => {
    it('should sign and verify correctly', () => {
      const { publicKey, privateKey } = generateSealKeyPair();
      const challenge = generateChallenge();

      const signature = signChallenge(challenge, privateKey);
      const isValid = verifySignature(challenge, signature, publicKey);

      expect(signature).toBeDefined();
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const { publicKey, privateKey } = generateSealKeyPair();
      const challenge = generateChallenge();

      const signature = signChallenge(challenge, privateKey);
      const isValid = verifySignature(challenge + 'modified', signature, publicKey);

      expect(isValid).toBe(false);
    });

    it('should reject wrong public key', () => {
      const pair1 = generateSealKeyPair();
      const pair2 = generateSealKeyPair();
      const challenge = generateChallenge();

      const signature = signChallenge(challenge, pair1.privateKey);
      const isValid = verifySignature(challenge, signature, pair2.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('encryptPrivateKey and decryptPrivateKey', () => {
    it('should encrypt and decrypt correctly', () => {
      const { privateKey } = generateSealKeyPair();
      const masterKey = 'test-master-key-123';

      const encrypted = encryptPrivateKey(privateKey, masterKey);
      const decrypted = decryptPrivateKey(encrypted, masterKey);

      expect(encrypted).not.toBe(privateKey);
      expect(encrypted).toContain(':'); // Format: iv:authTag:encrypted
      expect(decrypted).toBe(privateKey);
    });

    it('should fail with wrong master key', () => {
      const { privateKey } = generateSealKeyPair();
      const masterKey = 'test-master-key-123';
      const wrongKey = 'wrong-key-456';

      const encrypted = encryptPrivateKey(privateKey, masterKey);

      expect(() => decryptPrivateKey(encrypted, wrongKey)).toThrow();
    });
  });

  describe('isValidSerialNumber', () => {
    it('should accept valid 8-character hex serial', () => {
      expect(isValidSerialNumber('04ABCDEF')).toBe(true);
      expect(isValidSerialNumber('12345678')).toBe(true);
    });

    it('should accept valid 14-character hex serial', () => {
      expect(isValidSerialNumber('04ABCDEF123456')).toBe(true);
    });

    it('should reject too short serials', () => {
      expect(isValidSerialNumber('04ABC')).toBe(false);
      expect(isValidSerialNumber('1234567')).toBe(false);
    });

    it('should reject too long serials', () => {
      expect(isValidSerialNumber('04ABCDEF12345678')).toBe(false);
    });

    it('should reject non-hex characters', () => {
      expect(isValidSerialNumber('04ABCDEG')).toBe(false);
      expect(isValidSerialNumber('GHIJKLMN')).toBe(false);
    });
  });

  describe('canAttachSeal', () => {
    const baseSeal: NfcSeal = {
      id: 'seal-1',
      serialNumber: '04ABCDEF',
      batchId: null,
      status: NfcSealStatus.PROVISIONED,
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      challenge: 'ch',
      expectedReadCount: 0,
      actualReadCount: 0,
      attachedAt: null,
      attachedBy: null,
      attachedLocation: null,
      attachedLatitude: null,
      attachedLongitude: null,
      removedAt: null,
      removedBy: null,
      removedLocation: null,
      tamperIndicator: TamperIndicator.NONE,
      tamperDetails: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow attaching provisioned seal', () => {
      expect(canAttachSeal(baseSeal)).toBe(true);
    });

    it('should not allow attaching already attached seal', () => {
      const attachedSeal = { ...baseSeal, status: NfcSealStatus.ATTACHED };
      expect(canAttachSeal(attachedSeal)).toBe(false);
    });

    it('should not allow attaching seal with batchId', () => {
      const assignedSeal = { ...baseSeal, batchId: 'batch-1' };
      expect(canAttachSeal(assignedSeal)).toBe(false);
    });
  });

  describe('canVerifySeal', () => {
    const createSeal = (status: NfcSealStatus): NfcSeal => ({
      id: 'seal-1',
      serialNumber: '04ABCDEF',
      batchId: 'batch-1',
      status,
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      challenge: 'ch',
      expectedReadCount: 0,
      actualReadCount: 0,
      attachedAt: new Date(),
      attachedBy: 'user-1',
      attachedLocation: null,
      attachedLatitude: null,
      attachedLongitude: null,
      removedAt: null,
      removedBy: null,
      removedLocation: null,
      tamperIndicator: TamperIndicator.NONE,
      tamperDetails: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should allow verifying attached seal', () => {
      expect(canVerifySeal(createSeal(NfcSealStatus.ATTACHED))).toBe(true);
    });

    it('should allow verifying already verified seal', () => {
      expect(canVerifySeal(createSeal(NfcSealStatus.VERIFIED))).toBe(true);
    });

    it('should not allow verifying tampered seal', () => {
      expect(canVerifySeal(createSeal(NfcSealStatus.TAMPERED))).toBe(false);
    });

    it('should not allow verifying removed seal', () => {
      expect(canVerifySeal(createSeal(NfcSealStatus.REMOVED))).toBe(false);
    });
  });

  describe('canRemoveSeal', () => {
    const createSeal = (status: NfcSealStatus): NfcSeal => ({
      id: 'seal-1',
      serialNumber: '04ABCDEF',
      batchId: 'batch-1',
      status,
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      challenge: 'ch',
      expectedReadCount: 0,
      actualReadCount: 0,
      attachedAt: new Date(),
      attachedBy: 'user-1',
      attachedLocation: null,
      attachedLatitude: null,
      attachedLongitude: null,
      removedAt: null,
      removedBy: null,
      removedLocation: null,
      tamperIndicator: TamperIndicator.NONE,
      tamperDetails: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should allow removing attached seal', () => {
      expect(canRemoveSeal(createSeal(NfcSealStatus.ATTACHED))).toBe(true);
    });

    it('should allow removing verified seal', () => {
      expect(canRemoveSeal(createSeal(NfcSealStatus.VERIFIED))).toBe(true);
    });

    it('should not allow removing already removed seal', () => {
      expect(canRemoveSeal(createSeal(NfcSealStatus.REMOVED))).toBe(false);
    });
  });

  describe('isSealExpired', () => {
    const createSeal = (expiresAt: Date | null): NfcSeal => ({
      id: 'seal-1',
      serialNumber: '04ABCDEF',
      batchId: null,
      status: NfcSealStatus.PROVISIONED,
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      challenge: 'ch',
      expectedReadCount: 0,
      actualReadCount: 0,
      attachedAt: null,
      attachedBy: null,
      attachedLocation: null,
      attachedLatitude: null,
      attachedLongitude: null,
      removedAt: null,
      removedBy: null,
      removedLocation: null,
      tamperIndicator: TamperIndicator.NONE,
      tamperDetails: null,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should return false for no expiration date', () => {
      expect(isSealExpired(createSeal(null))).toBe(false);
    });

    it('should return false for future expiration', () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(isSealExpired(createSeal(futureDate))).toBe(false);
    });

    it('should return true for past expiration', () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(isSealExpired(createSeal(pastDate))).toBe(true);
    });
  });

  describe('detectCounterAnomaly', () => {
    it('should not detect anomaly for expected increase', () => {
      expect(detectCounterAnomaly(5, 5)).toBe(false);
      expect(detectCounterAnomaly(5, 6)).toBe(false);
      expect(detectCounterAnomaly(5, 10)).toBe(false);
    });

    it('should detect anomaly for counter decrease', () => {
      expect(detectCounterAnomaly(10, 5)).toBe(true);
    });

    it('should detect anomaly for large unexpected increase', () => {
      expect(detectCounterAnomaly(5, 20)).toBe(true); // More than 10 unexpected reads
    });
  });

  describe('calculateIntegrityScore', () => {
    const createSeal = (status: NfcSealStatus, tamperIndicator: TamperIndicator): NfcSeal => ({
      id: 'seal-1',
      serialNumber: '04ABCDEF',
      batchId: 'batch-1',
      status,
      publicKey: 'pk',
      encryptedPrivateKey: 'epk',
      challenge: 'ch',
      expectedReadCount: 5,
      actualReadCount: 5,
      attachedAt: new Date(),
      attachedBy: 'user-1',
      attachedLocation: null,
      attachedLatitude: null,
      attachedLongitude: null,
      removedAt: null,
      removedBy: null,
      removedLocation: null,
      tamperIndicator,
      tamperDetails: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createVerification = (isValid: boolean): NfcSealVerification => ({
      id: 'v-1',
      sealId: 'seal-1',
      verifiedBy: 'user-1',
      verifiedAt: new Date(),
      latitude: null,
      longitude: null,
      location: null,
      readCounter: 5,
      signatureProvided: 'sig',
      signatureExpected: 'sig',
      challengeUsed: 'ch',
      isValid,
      tamperIndicator: isValid ? TamperIndicator.NONE : TamperIndicator.SIGNATURE_MISMATCH,
      tamperDetails: null,
      deviceInfo: null,
    });

    it('should return 0 for tampered seal', () => {
      const seal = createSeal(NfcSealStatus.TAMPERED, TamperIndicator.SIGNATURE_MISMATCH);
      expect(calculateIntegrityScore(seal, [])).toBe(0);
    });

    it('should return 50 for expired seal', () => {
      const seal = createSeal(NfcSealStatus.EXPIRED, TamperIndicator.NONE);
      expect(calculateIntegrityScore(seal, [])).toBe(50);
    });

    it('should return 100 for perfect seal', () => {
      const seal = createSeal(NfcSealStatus.VERIFIED, TamperIndicator.NONE);
      expect(calculateIntegrityScore(seal, [])).toBe(100);
    });

    it('should deduct for failed verifications', () => {
      const seal = createSeal(NfcSealStatus.VERIFIED, TamperIndicator.NONE);
      const verifications = [
        createVerification(true),
        createVerification(false), // -20 points
      ];
      expect(calculateIntegrityScore(seal, verifications)).toBe(80);
    });

    it('should deduct for tamper indicators', () => {
      const seal = createSeal(NfcSealStatus.VERIFIED, TamperIndicator.LOCATION_MISMATCH);
      expect(calculateIntegrityScore(seal, [])).toBe(80); // -20 for warning
    });
  });

  describe('Status and Indicator Info', () => {
    it('should have info for all seal statuses', () => {
      Object.values(NfcSealStatus).forEach(status => {
        expect(NFC_SEAL_STATUS_INFO[status]).toBeDefined();
        expect(NFC_SEAL_STATUS_INFO[status].displayName).toBeDefined();
        expect(NFC_SEAL_STATUS_INFO[status].color).toBeDefined();
      });
    });

    it('should have info for all tamper indicators', () => {
      Object.values(TamperIndicator).forEach(indicator => {
        expect(TAMPER_INDICATOR_INFO[indicator]).toBeDefined();
        expect(TAMPER_INDICATOR_INFO[indicator].displayName).toBeDefined();
        expect(TAMPER_INDICATOR_INFO[indicator].severity).toBeDefined();
      });
    });
  });
});
