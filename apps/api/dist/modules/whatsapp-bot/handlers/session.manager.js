import { PrismaClient } from '@prisma/client';
import { logger } from '../../../infrastructure/logging/logger.js';
const prisma = new PrismaClient();
const sessions = new Map();
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export class SessionManager {
    async getSession(phoneNumber) {
        const normalized = this.normalizePhone(phoneNumber);
        let session = sessions.get(normalized);
        if (session && session.expiresAt < new Date()) {
            sessions.delete(normalized);
            session = undefined;
        }
        if (!session) {
            session = await this.createSession(normalized);
        }
        return session;
    }
    async createSession(phoneNumber) {
        const userInfo = await this.findUserByPhone(phoneNumber);
        const now = new Date();
        const session = {
            id: `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            phoneNumber,
            userId: userInfo?.userId,
            producerId: userInfo?.producerId,
            state: 'IDLE',
            context: {},
            language: 'es',
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
    updateState(phoneNumber, state) {
        const session = sessions.get(this.normalizePhone(phoneNumber));
        if (session) {
            session.state = state;
            session.lastMessageAt = new Date();
        }
    }
    updateContext(phoneNumber, context) {
        const session = sessions.get(this.normalizePhone(phoneNumber));
        if (session) {
            session.context = { ...session.context, ...context };
            session.lastMessageAt = new Date();
        }
    }
    incrementMessageCount(phoneNumber) {
        const session = sessions.get(this.normalizePhone(phoneNumber));
        if (session) {
            session.messageCount++;
            session.lastMessageAt = new Date();
        }
    }
    setLanguage(phoneNumber, language) {
        const session = sessions.get(this.normalizePhone(phoneNumber));
        if (session) {
            session.language = language;
        }
    }
    clearSession(phoneNumber) {
        sessions.delete(this.normalizePhone(phoneNumber));
    }
    async findUserByPhone(phoneNumber) {
        try {
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
        }
        catch (error) {
            logger.error('[SessionManager] Error finding user:', error);
            return null;
        }
    }
    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }
    classifyIntent(text) {
        const lower = text.toLowerCase().trim();
        if (/^(hola|hi|hey|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|hello|saludos)/.test(lower)) {
            return 'GREETING';
        }
        if (/^(gracias|thanks|thank\s*you|te\s*agradezco|muchas\s*gracias)/.test(lower)) {
            return 'THANKS';
        }
        if (/anticipo|advance|préstamo|prestamo|loan|dinero|money|capital/.test(lower)) {
            return 'REQUEST_ADVANCE';
        }
        if (/saldo|balance|cuenta|deuda|debo|owe|pending|pendiente/.test(lower)) {
            return 'CHECK_BALANCE';
        }
        if (/pagar|pago|pay|payment|abonar|depositar|transfer/.test(lower)) {
            return 'MAKE_PAYMENT';
        }
        if (/ayuda|help|soporte|support|agente|agent|humano|human|problema|problem/.test(lower)) {
            return 'CUSTOMER_SUPPORT';
        }
        return 'UNKNOWN';
    }
    parseReplyId(replyId) {
        const parts = replyId.split('_');
        return {
            action: parts.slice(0, -1).join('_') || replyId,
            data: parts.length > 1 ? parts[parts.length - 1] : undefined,
        };
    }
    getStats() {
        let totalMessages = 0;
        sessions.forEach((s) => {
            totalMessages += s.messageCount;
        });
        return {
            activeSessions: sessions.size,
            totalMessages,
        };
    }
    cleanup() {
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
export const sessionManager = new SessionManager();
setInterval(() => sessionManager.cleanup(), 60 * 60 * 1000);
