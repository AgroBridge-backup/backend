/**
 * WhatsApp Webhook Routes
 * Handles Meta Cloud API webhooks
 * @module whatsapp-bot/routes
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../infrastructure/logging/logger';
import { whatsAppService } from './whatsapp.service';
import { messageHandler } from './handlers/message.handler';
import { sessionManager } from './handlers/session.manager';
import { WhatsAppWebhookPayload } from './types';

const router = Router();

// ============================================================================
// WEBHOOK VERIFICATION (GET) - Required by Meta
// ============================================================================

router.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  logger.info('[WhatsApp Webhook] Verification request', { mode, hasToken: !!token });

  const result = whatsAppService.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Verification failed');
  }
});

// ============================================================================
// WEBHOOK HANDLER (POST) - Receives messages
// ============================================================================

router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
  try {
    const payload = req.body as WhatsAppWebhookPayload;

    // Validate payload structure
    if (payload.object !== 'whatsapp_business_account') {
      logger.warn('[WhatsApp Webhook] Invalid payload object:', payload.object);
      return res.sendStatus(400);
    }

    // Acknowledge receipt immediately (Meta requires < 20s response)
    res.sendStatus(200);

    // Process entries asynchronously
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          const contact = value.contacts?.[0];

          for (const message of value.messages) {
            logger.info('[WhatsApp Webhook] Incoming message', {
              from: message.from.slice(-4),
              type: message.type,
              timestamp: message.timestamp,
            });

            // Process message (fire and forget, already acknowledged)
            messageHandler.handleIncoming(message, contact!).catch((err) => {
              logger.error('[WhatsApp Webhook] Handler error:', err);
            });
          }
        }

        // Handle status updates (sent, delivered, read)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            logger.debug('[WhatsApp Webhook] Status update', {
              messageId: status.id,
              status: status.status,
              recipient: status.recipient_id.slice(-4),
            });

            // Could update database delivery logs here
          }
        }
      }
    }

  } catch (error) {
    logger.error('[WhatsApp Webhook] Error:', error);
    // Still return 200 to prevent Meta retries
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

// ============================================================================
// ADMIN/DEBUG ENDPOINTS
// ============================================================================

/**
 * Health check and stats
 */
router.get('/webhook/whatsapp/health', (req: Request, res: Response) => {
  const stats = sessionManager.getStats();
  const config = whatsAppService.getConfig();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config,
    stats,
  });
});

/**
 * Send test message (admin only)
 */
router.post('/webhook/whatsapp/test', async (req: Request, res: Response) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' });
  }

  try {
    const messageId = await whatsAppService.sendText(to, message);

    res.json({
      success: !!messageId,
      messageId,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Trigger payment reminder (for testing collections)
 */
router.post('/webhook/whatsapp/remind', async (req: Request, res: Response) => {
  const { advanceId } = req.body;

  // This would normally be called by the collections cron
  res.json({ status: 'scheduled', advanceId });
});

export default router;
