/**
 * WhatsApp Bot Module
 * Meta Business API Integration for AgroBridge
 *
 * Features:
 * - Request advances via WhatsApp
 * - Check balance and payments
 * - Payment link generation
 * - Bilingual support (ES/EN)
 * - Session management
 *
 * @module whatsapp-bot
 */

export { whatsAppService } from './whatsapp.service';
export { messageHandler } from './handlers/message.handler';
export { sessionManager } from './handlers/session.manager';
export { default as whatsAppRoutes } from './whatsapp.routes';
export * from './types';
export * from './templates/messages';
