/**
 * Privacy Utilities
 * P1-3/P1-4 FIX: Mask sensitive user information for public endpoints
 */

export class PrivacyUtils {
  /**
   * Get user initials (e.g., "JP" for "Juan Pérez")
   * @param firstName First name
   * @param lastName Last name
   * @returns Initials string or "AB" for AgroBridge default
   */
  static getInitials(firstName?: string | null, lastName?: string | null): string {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first && last ? `${first}${last}` : 'AB';
  }

  /**
   * Mask name for public display (e.g., "Juan P." for "Juan Pérez")
   * @param firstName First name
   * @param lastName Last name
   * @returns Masked name or "Usuario Anónimo" if no name
   */
  static maskName(firstName?: string | null, lastName?: string | null): string {
    if (!firstName && !lastName) {
      return 'Usuario Anónimo';
    }

    const first = firstName || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';

    if (first && lastInitial) {
      return `${first} ${lastInitial}.`;
    }

    return first || 'Usuario';
  }

  /**
   * Mask email for public display (e.g., "j***@example.com")
   * @param email Email address
   * @returns Masked email
   */
  static maskEmail(email?: string | null): string {
    if (!email) return '***@***.***';

    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***@***.***';

    const maskedLocal = localPart.charAt(0) + '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask phone number for public display (e.g., "+52 *** *** 1234")
   * @param phone Phone number
   * @returns Masked phone
   */
  static maskPhone(phone?: string | null): string {
    if (!phone) return '*** *** ****';

    // Keep last 4 digits visible
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return '*** *** ****';

    const lastFour = cleaned.slice(-4);
    return `*** *** ${lastFour}`;
  }

  /**
   * Get safe display name for public verification
   * @param user User object with firstName and lastName
   * @returns Safe display string
   */
  static getSafeDisplayName(user?: { firstName?: string | null; lastName?: string | null } | null): string {
    if (!user) return 'Verificado por AgroBridge';
    return this.maskName(user.firstName, user.lastName);
  }
}
