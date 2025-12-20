import { Router } from 'express';
import { logger } from '../../infrastructure/logging/logger.js';
import { whatsAppService } from './whatsapp.service.js';
import { messageHandler } from './handlers/message.handler.js';
import { sessionManager } from './handlers/session.manager.js';
const router = Router();
router.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    logger.info('[WhatsApp Webhook] Verification request', { mode, hasToken: !!token });
    const result = whatsAppService.verifyWebhook(mode, token, challenge);
    if (result) {
        res.status(200).send(result);
    }
    else {
        res.status(403).send('Verification failed');
    }
});
router.post('/webhook/whatsapp', async (req, res) => {
    try {
        const payload = req.body;
        if (payload.object !== 'whatsapp_business_account') {
            logger.warn('[WhatsApp Webhook] Invalid payload object:', payload.object);
            return res.sendStatus(400);
        }
        res.sendStatus(200);
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== 'messages')
                    continue;
                const value = change.value;
                if (value.messages && value.messages.length > 0) {
                    const contact = value.contacts?.[0];
                    for (const message of value.messages) {
                        logger.info('[WhatsApp Webhook] Incoming message', {
                            from: message.from.slice(-4),
                            type: message.type,
                            timestamp: message.timestamp,
                        });
                        messageHandler.handleIncoming(message, contact).catch((err) => {
                            logger.error('[WhatsApp Webhook] Handler error:', err);
                        });
                    }
                }
                if (value.statuses && value.statuses.length > 0) {
                    for (const status of value.statuses) {
                        logger.debug('[WhatsApp Webhook] Status update', {
                            messageId: status.id,
                            status: status.status,
                            recipient: status.recipient_id.slice(-4),
                        });
                    }
                }
            }
        }
    }
    catch (error) {
        logger.error('[WhatsApp Webhook] Error:', error);
        if (!res.headersSent) {
            res.sendStatus(200);
        }
    }
});
router.get('/webhook/whatsapp/health', (req, res) => {
    const stats = sessionManager.getStats();
    const config = whatsAppService.getConfig();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        config,
        stats,
    });
});
router.post('/webhook/whatsapp/test', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/webhook/whatsapp/remind', async (req, res) => {
    const { advanceId } = req.body;
    res.json({ status: 'scheduled', advanceId });
});
export default router;
