/**
 * Repayments Routes
 * Payment processing and tracking for advances
 * @module repayments/routes
 */

import { Router, Request, Response } from 'express';
import { repaymentService, RepaymentRequest } from '../services/repayment.service.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { PaymentMethod } from '@prisma/client';

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /health - Repayments module health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    module: 'repayments',
    timestamp: new Date().toISOString(),
    webhooks: {
      stripe: '/webhook/stripe',
      mercadopago: '/webhook/mercadopago',
    },
    lateFees: {
      gracePeriodDays: 0,
      percentagePerWeek: 5,
      maxPercentage: 20,
    },
  });
});

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

/**
 * POST /:advanceId - Record a payment
 */
router.post('/:advanceId', async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;
    const { amount, paymentMethod, referenceNumber, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Amount is required and must be positive',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        error: 'Payment method is required',
        validMethods: ['BANK_TRANSFER', 'CASH', 'STRIPE', 'MERCADOPAGO', 'SPEI', 'CODI'],
      });
    }

    logger.info('[Repayments Route] Recording payment', {
      advanceId,
      amount,
      method: paymentMethod,
    });

    const request: RepaymentRequest = {
      advanceId,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod as PaymentMethod,
      referenceNumber,
      notes,
      processedBy: (req as any).user?.id,
    };

    const result = await repaymentService.recordPayment(request);

    res.json(result);
  } catch (error) {
    logger.error('[Repayments Route] Record payment failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /:advanceId/balance - Get balance breakdown
 */
router.get('/:advanceId/balance', async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;

    const balance = await repaymentService.getBalanceBreakdown(advanceId);

    res.json(balance);
  } catch (error) {
    logger.error('[Repayments Route] Get balance failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /:advanceId/schedule - Get payment schedule
 */
router.get('/:advanceId/schedule', async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;

    const schedule = await repaymentService.getPaymentSchedule(advanceId);

    res.json(schedule);
  } catch (error) {
    logger.error('[Repayments Route] Get schedule failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /:advanceId/history - Get payment history
 */
router.get('/:advanceId/history', async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;

    const history = await repaymentService.getPaymentHistory(advanceId);

    res.json(history);
  } catch (error) {
    logger.error('[Repayments Route] Get history failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PATCH /:advanceId/extend - Extend due date (admin only)
 */
router.patch('/:advanceId/extend', async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;
    const { newDueDate, reason } = req.body;

    if (!newDueDate) {
      return res.status(400).json({
        error: 'New due date is required (ISO 8601 format)',
      });
    }

    const extendedBy = (req as any).user?.id || 'system';

    logger.info('[Repayments Route] Extending due date', {
      advanceId,
      newDueDate,
      reason,
      extendedBy,
    });

    const result = await repaymentService.extendDueDate(
      advanceId,
      new Date(newDueDate),
      reason || 'Admin extension',
      extendedBy
    );

    res.json(result);
  } catch (error) {
    logger.error('[Repayments Route] Extend due date failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /aging-report - Get AR aging report
 */
router.get('/aging-report', async (req: Request, res: Response) => {
  try {
    const report = await repaymentService.getAgingReport();

    res.json({
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Repayments Route] Get aging report failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// WEBHOOK ROUTES
// ============================================================================

/**
 * POST /webhook/stripe - Stripe webhook handler
 */
router.post('/webhook/stripe', async (req: Request, res: Response) => {
  try {
    // Acknowledge immediately
    res.sendStatus(200);

    // Process asynchronously
    setImmediate(async () => {
      try {
        const result = await repaymentService.processPaymentWebhook('stripe', req.body);
        logger.info('[Repayments Route] Stripe webhook processed', {
          type: req.body.type,
          processed: result.processed,
          advanceId: result.advanceId,
        });
      } catch (error) {
        logger.error('[Repayments Route] Stripe webhook error:', error);
      }
    });
  } catch (error) {
    logger.error('[Repayments Route] Stripe webhook failed:', error);
    if (!res.headersSent) {
      res.sendStatus(200); // Still return 200 to prevent retries
    }
  }
});

/**
 * POST /webhook/mercadopago - MercadoPago webhook handler
 */
router.post('/webhook/mercadopago', async (req: Request, res: Response) => {
  try {
    res.sendStatus(200);

    setImmediate(async () => {
      try {
        const result = await repaymentService.processPaymentWebhook('mercadopago', req.body);
        logger.info('[Repayments Route] MercadoPago webhook processed', {
          action: req.body.action,
          processed: result.processed,
        });
      } catch (error) {
        logger.error('[Repayments Route] MercadoPago webhook error:', error);
      }
    });
  } catch (error) {
    logger.error('[Repayments Route] MercadoPago webhook failed:', error);
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

export default router;
