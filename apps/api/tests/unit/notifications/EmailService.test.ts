/**
 * @file EmailService Unit Tests
 * @description Tests for SendGrid email service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @sendgrid/mail
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM_NAME;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('isAvailable', () => {
    it('should return false when API key is not configured', async () => {
      const { EmailService } = await import(
        '../../../src/infrastructure/notifications/services/EmailService.js'
      );
      const service = EmailService.getInstance();
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should return error when service is not initialized', async () => {
      const { EmailService } = await import(
        '../../../src/infrastructure/notifications/services/EmailService.js'
      );
      const service = EmailService.getInstance();

      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service not initialized');
    });

    it('should validate email address format', async () => {
      const { EmailService } = await import(
        '../../../src/infrastructure/notifications/services/EmailService.js'
      );
      const service = EmailService.getInstance();

      const result = await service.sendEmail({
        to: 'invalid-email',
        subject: 'Test Subject',
        text: 'Test body',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendBatchCreatedEmail', () => {
    it('should return error when service is not initialized', async () => {
      const { EmailService } = await import(
        '../../../src/infrastructure/notifications/services/EmailService.js'
      );
      const service = EmailService.getInstance();

      const result = await service.sendBatchCreatedEmail('test@example.com', {
        batchId: 'batch-123',
        batchNumber: 'AB-2024-001',
        variety: 'Hass',
        producerName: 'Test Producer',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendSensorAlertEmail', () => {
    it('should return error when service is not initialized', async () => {
      const { EmailService } = await import(
        '../../../src/infrastructure/notifications/services/EmailService.js'
      );
      const service = EmailService.getInstance();

      const result = await service.sendSensorAlertEmail('test@example.com', {
        sensorType: 'Temperature',
        currentValue: 35,
        threshold: 30,
        unit: 'C',
        location: 'Greenhouse A',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should return error when service is not initialized', async () => {
      const { EmailService } = await import(
        '../../../src/infrastructure/notifications/services/EmailService.js'
      );
      const service = EmailService.getInstance();

      const result = await service.sendWelcomeEmail(
        'test@example.com',
        'Test User'
      );

      expect(result.success).toBe(false);
    });
  });
});
