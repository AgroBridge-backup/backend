import { describe, it, expect } from 'vitest';
import { Password, PasswordValidationError } from '../../../src/domain/value-objects/Password.js';

describe('Password Value Object', () => {
  describe('create', () => {
    it('should create a valid password', () => {
      const password = Password.create('StrongPass123!@#');
      expect(password.getValue()).toBe('StrongPass123!@#');
    });

    it('should throw error for password shorter than 8 characters', () => {
      expect(() => Password.create('Short1!')).toThrow(PasswordValidationError);
    });

    it('should throw error for password without uppercase', () => {
      expect(() => Password.create('lowercase123!')).toThrow(PasswordValidationError);
    });

    it('should throw error for password without lowercase', () => {
      expect(() => Password.create('UPPERCASE123!')).toThrow(PasswordValidationError);
    });

    it('should throw error for password without number', () => {
      expect(() => Password.create('NoNumbers!@#')).toThrow(PasswordValidationError);
    });

    it('should throw error for password without special character', () => {
      expect(() => Password.create('NoSpecial123')).toThrow(PasswordValidationError);
    });

    it('should throw error for password with spaces', () => {
      expect(() => Password.create('Has Spaces123!')).toThrow(PasswordValidationError);
    });

    it('should throw error for common password', () => {
      expect(() => Password.create('password123!')).toThrow(PasswordValidationError);
    });

    it('should throw error for password longer than 128 characters', () => {
      const longPassword = 'Aa1!' + 'x'.repeat(130);
      expect(() => Password.create(longPassword)).toThrow(PasswordValidationError);
    });
  });

  describe('validate', () => {
    it('should return empty array for valid password', () => {
      const errors = Password.validate('ValidPass123!@#');
      expect(errors).toHaveLength(0);
    });

    it('should return multiple errors for very weak password', () => {
      const errors = Password.validate('weak');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('La contraseña debe tener al menos 8 caracteres');
    });
  });

  describe('isValid', () => {
    it('should return true for valid password', () => {
      expect(Password.isValid('ValidPass123!@#')).toBe(true);
    });

    it('should return false for invalid password', () => {
      expect(Password.isValid('weak')).toBe(false);
    });
  });

  describe('calculateStrength', () => {
    it('should return lower strength for shorter passwords', () => {
      const shortStrength = Password.calculateStrength('Aa1!xxxx');
      const longStrength = Password.calculateStrength('VeryLongAndStr0ng!P@ssword');
      expect(shortStrength.score).toBeLessThan(longStrength.score);
    });

    it('should return high strength for strong password', () => {
      const strength = Password.calculateStrength('VeryStr0ng!P@ssword123');
      expect(strength.score).toBeGreaterThan(70);
      expect(['Fuerte', 'Muy fuerte']).toContain(strength.level);
    });

    it('should indicate validity status', () => {
      const validStrength = Password.calculateStrength('ValidPass123!@#');
      expect(validStrength.valid).toBe(true);

      const invalidStrength = Password.calculateStrength('weak');
      expect(invalidStrength.valid).toBe(false);
    });
  });

  describe('toString', () => {
    it('should mask password when converted to string', () => {
      const password = Password.create('StrongPass123!@#');
      expect(password.toString()).toBe('********');
    });
  });
});
