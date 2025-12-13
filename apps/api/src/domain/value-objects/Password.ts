/**
 * Password Value Object
 * Implements enterprise-grade password complexity rules
 * Based on OWASP and NIST password guidelines
 */
export class Password {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Create a new Password value object with validation
   * @throws Error if password doesn't meet complexity requirements
   */
  static create(password: string): Password {
    const errors = this.validate(password);
    if (errors.length > 0) {
      throw new PasswordValidationError(errors);
    }
    return new Password(password);
  }

  /**
   * Validate password without throwing (returns array of errors)
   */
  static validate(password: string): string[] {
    const errors: string[] = [];

    // Minimum 8 characters (NIST recommendation)
    if (password.length < 8) {
      errors.push('La contraseña debe tener al menos 8 caracteres');
    }

    // Maximum 128 characters (prevent DoS via bcrypt)
    if (password.length > 128) {
      errors.push('La contraseña no puede exceder 128 caracteres');
    }

    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra mayúscula');
    }

    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una letra minúscula');
    }

    // At least one number
    if (!/\d/.test(password)) {
      errors.push('La contraseña debe contener al menos un número');
    }

    // At least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      errors.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*...)');
    }

    // No spaces allowed
    if (/\s/.test(password)) {
      errors.push('La contraseña no puede contener espacios');
    }

    // Check against common passwords blacklist
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Esta contraseña es demasiado común. Elige otra');
    }

    // Check for sequential characters (e.g., 123, abc)
    if (hasSequentialChars(password, 4)) {
      errors.push('La contraseña no puede contener más de 3 caracteres secuenciales');
    }

    // Check for repeated characters (e.g., aaaa)
    if (hasRepeatedChars(password, 4)) {
      errors.push('La contraseña no puede contener más de 3 caracteres repetidos consecutivos');
    }

    return errors;
  }

  /**
   * Check if a password is valid (without throwing)
   */
  static isValid(password: string): boolean {
    return this.validate(password).length === 0;
  }

  /**
   * Calculate password strength score (0-100)
   */
  static calculateStrength(password: string): PasswordStrength {
    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 15;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 5;

    // Character diversity scoring
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score += 15;

    // Bonus for mixing character types
    const charTypes = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    ].filter(Boolean).length;

    if (charTypes >= 3) score += 10;
    if (charTypes === 4) score += 5;

    // Penalty for common patterns
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) score -= 30;
    if (hasSequentialChars(password, 3)) score -= 10;
    if (hasRepeatedChars(password, 3)) score -= 10;

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Determine level
    let level: 'Muy débil' | 'Débil' | 'Media' | 'Fuerte' | 'Muy fuerte';
    if (score < 30) level = 'Muy débil';
    else if (score < 50) level = 'Débil';
    else if (score < 70) level = 'Media';
    else if (score < 85) level = 'Fuerte';
    else level = 'Muy fuerte';

    return {
      score,
      level,
      valid: Password.isValid(password),
    };
  }

  /**
   * Get the raw password value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * String representation (masked for security)
   */
  toString(): string {
    return '********';
  }
}

/**
 * Password validation error with multiple error messages
 */
export class PasswordValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('. '));
    this.name = 'PasswordValidationError';
    this.errors = errors;
  }
}

export interface PasswordStrength {
  score: number;
  level: 'Muy débil' | 'Débil' | 'Media' | 'Fuerte' | 'Muy fuerte';
  valid: boolean;
}

/**
 * Check for sequential characters
 */
function hasSequentialChars(str: string, minLength: number): boolean {
  const sequences = [
    '0123456789',
    'abcdefghijklmnopqrstuvwxyz',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
  ];

  const lowerStr = str.toLowerCase();

  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - minLength; i++) {
      const subSeq = seq.substring(i, i + minLength);
      if (lowerStr.includes(subSeq)) return true;
      // Check reverse sequence too
      if (lowerStr.includes(subSeq.split('').reverse().join(''))) return true;
    }
  }

  return false;
}

/**
 * Check for repeated characters
 */
function hasRepeatedChars(str: string, minLength: number): boolean {
  const regex = new RegExp(`(.)\\1{${minLength - 1},}`);
  return regex.test(str);
}

/**
 * Common passwords blacklist (top 100 most common)
 */
const COMMON_PASSWORDS = [
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password1!',
  'password123',
  'password123!',
  'qwerty123',
  'qwerty123!',
  'admin123',
  'admin123!',
  'welcome1',
  'welcome1!',
  'welcome123',
  'letmein1',
  'letmein1!',
  'monkey123',
  'dragon123',
  'master123',
  'login123',
  'abc12345',
  'abc123456',
  'iloveyou1',
  'sunshine1',
  'princess1',
  'football1',
  'baseball1',
  'michael1',
  'shadow123',
  'ashley123',
  'daniel123',
  'jessica1',
  'charlie1',
  'superman1',
  'qazwsx123',
  'trustno1',
  'passw0rd',
  'passw0rd!',
  'p@ssw0rd',
  'p@ssword1',
  'pass1234',
  'pass12345',
  'test1234',
  'test12345',
  'changeme1',
  'changeme!',
  'secret123',
  'access123',
  'master1!',
  'hello123',
  'hello123!',
  'asdf1234',
  'zxcv1234',
  'qwer1234',
  '1q2w3e4r',
  '1qaz2wsx',
  'summer2024',
  'winter2024',
  'spring2024',
  'autumn2024',
];
