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

export { whatsAppService } from "./whatsapp.service.js";
export { messageHandler } from "./handlers/message.handler.js";
export { sessionManager } from "./handlers/session.manager.js";
export { default as whatsAppRoutes } from "./whatsapp.routes.js";
export * from "./types/index.js";
export * from "./templates/messages.js";
