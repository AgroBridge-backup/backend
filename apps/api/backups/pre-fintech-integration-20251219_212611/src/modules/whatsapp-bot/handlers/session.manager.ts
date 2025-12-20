/**
 * WhatsApp Session Manager
 * Tracks conversation state per phone number
 * @module whatsapp-bot/handlers/session.manager
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger';
import { WhatsAppSession, ConversationState, SessionContext, UserIntent } from '../types';

const prisma = new PrismaClient();

// In-memory session cache (Redis in production)
const sessions = new Map<string, WhatsAppSession>();

// Session timeout (24 hours)
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export class SessionManager {
  /**
   * Get or create a session for a phone number
   */
  async getSession(phoneNumber: string): Promise<WhatsAppSession> {
    const normalized = this.normalizePhone(phoneNumber);

    // Check memory cache
    let session = sessions.get(normalized);

    // Check if session expired
    if (session && session.expiresAt < new Date()) {
      sessions.delete(normalized);
      session = undefined;
    }

    if (!session) {
      session = await this.createSession(normalized);
    }

    return session;
  }

  /**
   * Create a new session
   */
  private async createSession(phoneNumber: string): Promise<WhatsAppSession> {
    // Try to find user by phone number
    const userInfo = await this.findUserByPhone(phoneNumber);

    const now = new Date();
    const session: WhatsAppSession = {
      id: `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      phoneNumber,
      userId: userInfo?.userId,
      producerId: userInfo?.producerId,
      state: 'IDLE',
      context: {},
      language: 'es', // Default to Spanish
      lastMessageAt: now,
      messageCount: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TIMEOUT_MS),
    };

    sessions.set(phoneNumber, session);

    logger.info('[SessionManager] Created session', {
      sessionId: session.id,
      phone: phoneNumber.slice(-4),
      userId: session.userId,
    });

    return session;
  }

  /**
   * Update session state
   */
  updateState(phoneNumber: string, state: ConversationState): void {
    const session = sessions.get(this.normalizePhone(phoneNumber));
    if (session) {
      session.state = state;
      session.lastMessageAt = new Date();
    }
  }

  /**
   * Update session context
   */
  updateContext(phoneNumber: string, context: Partial<SessionContext>): void {
    const session = sessions.get(this.normalizePhone(phoneNumber));
    if (session) {
      session.context = { ...session.context, ...context };
      session.lastMessageAt = new Date();
    }
  }

  /**
   * Increment message count
   */
  incrementMessageCount(phoneNumber: string): void {
    const session = sessions.get(this.normalizePhone(phoneNumber));
    if (session) {
      session.messageCount++;
      session.lastMessageAt = new Date();
    }
  }

  /**
   * Set language preference
   */
  setLanguage(phoneNumber: string, language: 'es' | 'en'): void {
    const session = sessions.get(this.normalizePhone(phoneNumber));
    if (session) {
      session.language = language;
    }
  }

  /**
   * Clear session (logout)
   */
  clearSession(phoneNumber: string): void {
    sessions.delete(this.normalizePhone(phoneNumber));
  }

  /**
   * Find user and producer by phone number
   */
  private async findUserByPhone(phoneNumber: string): Promise<{
    userId: string;
    producerId?: string;
  } | null> {
    try {
      // Search in notification preferences (contains verified phone)
      const preference = await prisma.notificationPreference.findFirst({
        where: {
          phoneNumber: {
            contains: phoneNumber.slice(-10),
          },
          phoneVerified: true,
        },
        include: {
          user: {
            include: {
              producer: true,
            },
          },
        },
      });

      if (preference?.user) {
        return {
          userId: preference.user.id,
          producerId: preference.user.producer?.id,
        };
      }

      return null;
    } catch (error) {
      logger.error('[SessionManager] Error finding user:', error);
      return null;
    }
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Classify user intent from message text
   */
  classifyIntent(text: string): UserIntent {
    const lower = text.toLowerCase().trim();

    // Greeting patterns
    if (/^(hola|hi|hey|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|hello|saludos)/.test(lower)) {
      return 'GREETING';
    }

    // Thanks patterns
    if (/^(gracias|thanks|thank\s*you|te\s*agradezco|muchas\s*gracias)/.test(lower)) {
      return 'THANKS';
    }

    // Advance request patterns
    if (/anticipo|advance|préstamo|prestamo|loan|dinero|money|capital/.test(lower)) {
      return 'REQUEST_ADVANCE';
    }

    // Balance check patterns
    if (/saldo|balance|cuenta|deuda|debo|owe|pending|pendiente/.test(lower)) {
      return 'CHECK_BALANCE';
    }

    // Payment patterns
    if (/pagar|pago|pay|payment|abonar|depositar|transfer/.test(lower)) {
      return 'MAKE_PAYMENT';
    }

    // Support patterns
    if (/ayuda|help|soporte|support|agente|agent|humano|human|problema|problem/.test(lower)) {
      return 'CUSTOMER_SUPPORT';
    }

    return 'UNKNOWN';
  }

  /**
   * Parse button/list reply IDs
   */
  parseReplyId(replyId: string): {
    action: string;
    data?: string;
  } {
    const parts = replyId.split('_');
    return {
      action: parts.slice(0, -1).join('_') || replyId,
      data: parts.length > 1 ? parts[parts.length - 1] : undefined,
    };
  }

  /**
   * Get session stats for monitoring
   */
  getStats(): {
    activeSessions: number;
    totalMessages: number;
  } {
    let totalMessages = 0;
    sessions.forEach((s) => {
      totalMessages += s.messageCount;
    });

    return {
      activeSessions: sessions.size,
      totalMessages,
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanup(): number {
    const now = new Date();
    let cleaned = 0;

    sessions.forEach((session, key) => {
      if (session.expiresAt < now) {
        sessions.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.info('[SessionManager] Cleaned up expired sessions', { count: cleaned });
    }

    return cleaned;
  }
}

// Export singleton
export const sessionManager = new SessionManager();

// Run cleanup every hour
setInterval(() => sessionManager.cleanup(), 60 * 60 * 1000);
