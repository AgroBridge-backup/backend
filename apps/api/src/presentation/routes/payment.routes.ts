/**
 * @file Payment Routes
 * @description Stripe payment integration routes
 *
 * Endpoints:
 * - GET  /api/v1/payments/subscription - Get current subscription
 * - POST /api/v1/payments/subscription - Create/upgrade subscription
 * - PATCH /api/v1/payments/subscription - Update subscription tier
 * - DELETE /api/v1/payments/subscription - Cancel subscription
 * - POST /api/v1/payments/subscription/resume - Resume canceled subscription
 * - GET  /api/v1/payments/methods - List payment methods
 * - POST /api/v1/payments/methods - Add payment method
 * - DELETE /api/v1/payments/methods/:paymentMethodId - Remove payment method
 * - POST /api/v1/payments/methods/default - Set default payment method
 * - POST /api/v1/payments/one-time - Create one-time payment
 * - GET  /api/v1/payments/invoices - List invoices
 * - GET  /api/v1/payments/invoices/:invoiceId/pdf - Get invoice PDF
 * - POST /api/v1/payments/portal - Create billing portal session
 * - GET  /api/v1/payments/usage - Check usage limits
 * - GET  /api/v1/payments/tiers - Get available subscription tiers
 * - POST /api/v1/payments/webhook - Stripe webhook endpoint
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, raw } from "express";
import { PrismaClient } from "@prisma/client";
import { validateRequest } from "../middlewares/validator.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import {
  PaymentService,
  createPaymentService,
  PaymentServiceError,
} from "../../infrastructure/payment/PaymentService.js";
import {
  StripeWebhookHandler,
  createStripeWebhookHandler,
  WebhookHandlerError,
} from "../../infrastructure/payment/webhooks/StripeWebhookHandler.js";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  addPaymentMethodSchema,
  removePaymentMethodSchema,
  setDefaultPaymentMethodSchema,
  createOneTimePaymentSchema,
  listInvoicesSchema,
  getInvoicePdfSchema,
  createPortalSessionSchema,
  checkUsageSchema,
} from "../validators/payment.validator.js";
import logger from "../../shared/utils/logger.js";

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT ROUTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createPaymentRouter(prisma: PrismaClient): Router {
  const router = Router();
  const paymentService = createPaymentService(prisma);
  const webhookHandler = createStripeWebhookHandler(prisma);

  // ═══════════════════════════════════════════════════════════════════════════════
  // WEBHOOK ENDPOINT (Must be before JSON body parser)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/payments/webhook
   * Stripe webhook endpoint
   * Note: This endpoint uses raw body parser for signature verification
   */
  router.post(
    "/webhook",
    raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"];

      if (!signature || typeof signature !== "string") {
        logger.warn("[PaymentRoutes] Webhook missing signature");
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_SIGNATURE",
            message: "Missing Stripe signature",
          },
        });
      }

      try {
        const result = await webhookHandler.handleWebhook(req.body, signature);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof WebhookHandlerError) {
          logger.warn("[PaymentRoutes] Webhook error", {
            code: error.code,
            message: error.message,
          });
          return res.status(error.statusCode).json({
            success: false,
            error: { code: error.code, message: error.message },
          });
        }
        logger.error("[PaymentRoutes] Unexpected webhook error", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        res.status(500).json({
          success: false,
          error: {
            code: "WEBHOOK_ERROR",
            message: "Webhook processing failed",
          },
        });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/payments/tiers
   * Get available subscription tiers and pricing
   * Public endpoint
   */
  router.get(
    "/tiers",
    RateLimiterConfig.api(),
    async (req: Request, res: Response) => {
      const tiers = paymentService.getTierConfigs().map((tier) => ({
        tier: tier.tier,
        name: tier.name,
        priceMonthly: tier.priceMonthly / 100, // Convert to dollars
        priceYearly: tier.priceYearly / 100,
        limits: {
          batches: tier.batchesLimit === -1 ? "unlimited" : tier.batchesLimit,
          apiCalls:
            tier.apiCallsLimit === -1 ? "unlimited" : tier.apiCallsLimit,
          storageMb:
            tier.storageLimitMb === -1 ? "unlimited" : tier.storageLimitMb,
        },
      }));

      res.json({
        success: true,
        data: { tiers },
      });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/payments/subscription
   * Get current subscription details
   * Requires authentication
   */
  router.get(
    "/subscription",
    authenticate(),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const subscription = await paymentService.getSubscription(
          req.user.userId,
        );

        if (!subscription) {
          return res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "No subscription found" },
          });
        }

        res.json({
          success: true,
          data: subscription,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * POST /api/v1/payments/subscription
   * Create or upgrade subscription
   * Requires authentication
   */
  router.post(
    "/subscription",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(createSubscriptionSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        // Get user details for Stripe customer
        const user = await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: { code: "USER_NOT_FOUND", message: "User not found" },
          });
        }

        const { tier, paymentMethodId, billingCycle, trialDays } = req.body;

        const subscription = await paymentService.createSubscription({
          userId: req.user.userId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          tier,
          paymentMethodId,
          billingCycle,
          trialDays,
        });

        res.status(201).json({
          success: true,
          data: subscription,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * PATCH /api/v1/payments/subscription
   * Update subscription tier
   * Requires authentication
   */
  router.patch(
    "/subscription",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(updateSubscriptionSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const { tier, billingCycle, prorationBehavior } = req.body;

        const subscription = await paymentService.updateSubscription({
          userId: req.user.userId,
          tier,
          billingCycle,
          prorationBehavior,
        });

        res.json({
          success: true,
          data: subscription,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * DELETE /api/v1/payments/subscription
   * Cancel subscription
   * Requires authentication
   */
  router.delete(
    "/subscription",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(cancelSubscriptionSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const { immediately } = req.body;

        const subscription = await paymentService.cancelSubscription(
          req.user.userId,
          immediately,
        );

        res.json({
          success: true,
          data: subscription,
          message: immediately
            ? "Subscription canceled immediately"
            : "Subscription will be canceled at end of billing period",
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * POST /api/v1/payments/subscription/resume
   * Resume a canceled subscription (before period end)
   * Requires authentication
   */
  router.post(
    "/subscription/resume",
    authenticate(),
    RateLimiterConfig.api(),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const subscription = await paymentService.resumeSubscription(
          req.user.userId,
        );

        res.json({
          success: true,
          data: subscription,
          message: "Subscription resumed successfully",
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAYMENT METHOD ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/payments/methods
   * List payment methods
   * Requires authentication
   */
  router.get(
    "/methods",
    authenticate(),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const methods = await paymentService.listPaymentMethods(
          req.user.userId,
        );

        res.json({
          success: true,
          data: { methods },
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * POST /api/v1/payments/methods
   * Add a payment method
   * Requires authentication
   */
  router.post(
    "/methods",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(addPaymentMethodSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const { paymentMethodId, setAsDefault } = req.body;

        const method = await paymentService.addPaymentMethod(
          req.user.userId,
          paymentMethodId,
          setAsDefault,
        );

        res.status(201).json({
          success: true,
          data: method,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * DELETE /api/v1/payments/methods/:paymentMethodId
   * Remove a payment method
   * Requires authentication
   */
  router.delete(
    "/methods/:paymentMethodId",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(removePaymentMethodSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        await paymentService.removePaymentMethod(
          req.user.userId,
          req.params.paymentMethodId,
        );

        res.status(204).send();
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * POST /api/v1/payments/methods/default
   * Set default payment method
   * Requires authentication
   */
  router.post(
    "/methods/default",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(setDefaultPaymentMethodSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        await paymentService.setDefaultPaymentMethod(
          req.user.userId,
          req.body.paymentMethodId,
        );

        res.json({
          success: true,
          message: "Default payment method updated",
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // ONE-TIME PAYMENT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/payments/one-time
   * Create one-time payment
   * Requires authentication
   */
  router.post(
    "/one-time",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(createOneTimePaymentSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const { amount, currency, description, paymentMethodId, metadata } =
          req.body;

        const payment = await paymentService.createOneTimePayment({
          userId: req.user.userId,
          amount,
          currency,
          description,
          paymentMethodId,
          metadata,
        });

        res.status(201).json({
          success: true,
          data: payment,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVOICE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/payments/invoices
   * List invoices
   * Requires authentication
   */
  router.get(
    "/invoices",
    authenticate(),
    validateRequest(listInvoicesSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const limit = parseInt(req.query.limit as string, 10) || 10;
        const invoices = await paymentService.listInvoices(
          req.user.userId,
          limit,
        );

        res.json({
          success: true,
          data: { invoices },
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  /**
   * GET /api/v1/payments/invoices/:invoiceId/pdf
   * Get invoice PDF URL
   * Requires authentication
   */
  router.get(
    "/invoices/:invoiceId/pdf",
    authenticate(),
    validateRequest(getInvoicePdfSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const pdfUrl = await paymentService.getInvoicePdf(
          req.user.userId,
          req.params.invoiceId,
        );

        if (!pdfUrl) {
          return res.status(404).json({
            success: false,
            error: {
              code: "PDF_NOT_AVAILABLE",
              message: "Invoice PDF not available",
            },
          });
        }

        res.json({
          success: true,
          data: { pdfUrl },
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // BILLING PORTAL ENDPOINT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/payments/portal
   * Create billing portal session
   * Requires authentication
   */
  router.post(
    "/portal",
    authenticate(),
    RateLimiterConfig.api(),
    validateRequest(createPortalSessionSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const returnUrl =
          req.body.returnUrl ||
          process.env.FRONTEND_URL ||
          "http://localhost:3000/settings/billing";

        const session = await paymentService.createPortalSession(
          req.user.userId,
          returnUrl,
        );

        res.json({
          success: true,
          data: session,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // USAGE ENDPOINT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/payments/usage
   * Check usage limits
   * Requires authentication
   */
  router.get(
    "/usage",
    authenticate(),
    validateRequest(checkUsageSchema),
    async (req: Request, res: Response) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({
            success: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        }

        const type = req.query.type as "batches" | "apiCalls" | "storage";
        const amount = parseInt(req.query.amount as string, 10) || 1;

        const usage = await paymentService.checkUsage(
          req.user.userId,
          type,
          amount,
        );

        res.json({
          success: true,
          data: usage,
        });
      } catch (error) {
        handlePaymentError(error, res);
      }
    },
  );

  return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle payment service errors
 */
function handlePaymentError(error: unknown, res: Response): void {
  if (error instanceof PaymentServiceError) {
    logger.warn("[PaymentRoutes] Payment service error", {
      code: error.code,
      message: error.message,
    });
    res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
    return;
  }

  logger.error("[PaymentRoutes] Unexpected error", {
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
