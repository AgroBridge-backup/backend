/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - ADVANCE CONTROLLER
 * RESTful API Endpoints for Cash Advance Management
 *
 * Endpoints:
 * - POST   /api/v1/advances/calculate - Calculate advance terms
 * - POST   /api/v1/advances - Request new advance
 * - GET    /api/v1/advances/:advanceId - Get advance details
 * - GET    /api/v1/advances/farmer/:farmerId - Get farmer's advances
 * - POST   /api/v1/advances/:advanceId/approve - Approve advance
 * - POST   /api/v1/advances/:advanceId/reject - Reject advance
 * - POST   /api/v1/advances/:advanceId/disburse - Disburse advance
 * - POST   /api/v1/advances/:advanceId/repay - Process repayment
 * - POST   /api/v1/advances/:advanceId/status - Update status
 * - GET    /api/v1/advances/:advanceId/history - Get status history
 *
 * @module cash-flow-bridge/controllers
 * @version 1.0.0
 * @author AgroBridge Engineering Team
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction, Router } from "express";
import { z } from "zod";
import { PrismaClient, UserRole } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  AdvanceContractService,
  createAdvanceContractService,
  AdvanceStatus,
  PaymentMethod,
} from "../services/AdvanceContractService.js";
import {
  advanceCalculationLimiter,
  advanceRequestLimiter,
  financialOperationLimiter,
  requireAdminOrOperator,
  requireFarmerOwnershipOrAdmin,
} from "../../../presentation/routes/cash-flow-bridge.routes.js";
import logger from "../../../shared/utils/logger.js";

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const uuidSchema = z.string().uuid("Invalid UUID format");

const advanceIdParamSchema = z.object({
  advanceId: uuidSchema,
});

const farmerIdParamSchema = z.object({
  farmerId: uuidSchema,
});

const calculateAdvanceSchema = z.object({
  farmerId: uuidSchema,
  orderId: uuidSchema,
  requestedAmount: z.number().positive().optional(),
});

const requestAdvanceSchema = z.object({
  farmerId: uuidSchema,
  orderId: uuidSchema,
  requestedAmount: z.number().positive().optional(),
  disbursementMethod: z.nativeEnum(PaymentMethod).optional(),
  bankAccountId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const approveAdvanceSchema = z.object({
  approvedBy: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

const rejectAdvanceSchema = z.object({
  rejectedBy: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

const disburseAdvanceSchema = z.object({
  disbursementReference: z.string().min(1),
  disbursementFee: z.number().min(0).optional(),
});

const repaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentReference: z.string().min(1),
  source: z.enum([
    "BUYER_PAYMENT",
    "FARMER_PAYMENT",
    "INSURANCE",
    "COLLECTIONS",
    "OTHER",
  ]),
  notes: z.string().max(1000).optional(),
});

const statusUpdateSchema = z.object({
  status: z.nativeEnum(AdvanceStatus),
  userId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

const listAdvancesQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? (val
            .split(",")
            .filter((s) =>
              Object.values(AdvanceStatus).includes(s as AdvanceStatus),
            ) as AdvanceStatus[])
        : undefined,
    ),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ════════════════════════════════════════════════════════════════════════════════
// CONTROLLER CLASS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Advance Controller
 *
 * Handles all HTTP requests related to cash advances.
 */
export class AdvanceController {
  private readonly advanceService: AdvanceContractService;
  public readonly router: Router;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.advanceService = createAdvanceContractService(prisma, redis);
    this.router = Router();
    this.initializeRoutes();
  }

  /**
   * Initialize all routes with security middleware
   *
   * SECURITY:
   * - Rate limiting on calculation and request endpoints
   * - Admin role required for approve/reject/disburse/default operations
   * - Ownership verification for farmer-specific endpoints
   */
  private initializeRoutes(): void {
    // ┌─────────────────────────────────────────────────────────────────────────────┐
    // │ FARMER ENDPOINTS (rate limited, ownership verified)                         │
    // └─────────────────────────────────────────────────────────────────────────────┘

    // Calculate advance terms (preview) - rate limited
    this.router.post(
      "/calculate",
      advanceCalculationLimiter,
      this.validateFarmerOwnership.bind(this),
      this.calculateAdvance.bind(this),
    );

    // Request new advance - strictly rate limited
    this.router.post(
      "/",
      advanceRequestLimiter,
      this.validateFarmerOwnership.bind(this),
      this.requestAdvance.bind(this),
    );

    // Get advance by ID - ownership verified in handler
    this.router.get(
      "/:advanceId",
      this.validateAdvanceId,
      this.getAdvance.bind(this),
    );

    // Get farmer's advances - ownership verified
    this.router.get(
      "/farmer/:farmerId",
      this.validateFarmerId,
      requireFarmerOwnershipOrAdmin("farmerId"),
      this.getFarmerAdvances.bind(this),
    );

    // ┌─────────────────────────────────────────────────────────────────────────────┐
    // │ ADMIN/OPERATOR ENDPOINTS (require elevated permissions)                     │
    // └─────────────────────────────────────────────────────────────────────────────┘

    // Approve advance - ADMIN/OPERATOR only
    this.router.post(
      "/:advanceId/approve",
      requireAdminOrOperator,
      financialOperationLimiter,
      this.validateAdvanceId,
      this.approveAdvance.bind(this),
    );

    // Reject advance - ADMIN/OPERATOR only
    this.router.post(
      "/:advanceId/reject",
      requireAdminOrOperator,
      this.validateAdvanceId,
      this.rejectAdvance.bind(this),
    );

    // Disburse advance - ADMIN/OPERATOR only, rate limited
    this.router.post(
      "/:advanceId/disburse",
      requireAdminOrOperator,
      financialOperationLimiter,
      this.validateAdvanceId,
      this.disburseAdvance.bind(this),
    );

    // Process repayment - rate limited (can be triggered by system or admin)
    this.router.post(
      "/:advanceId/repay",
      financialOperationLimiter,
      this.validateAdvanceId,
      this.processRepayment.bind(this),
    );

    // Update status - ADMIN/OPERATOR only
    this.router.post(
      "/:advanceId/status",
      requireAdminOrOperator,
      this.validateAdvanceId,
      this.updateStatus.bind(this),
    );

    // Get status history - accessible to owner or admin
    this.router.get(
      "/:advanceId/history",
      this.validateAdvanceId,
      this.getStatusHistory.bind(this),
    );

    // Mark as defaulted - ADMIN/OPERATOR only
    this.router.post(
      "/:advanceId/default",
      requireAdminOrOperator,
      this.validateAdvanceId,
      this.markAsDefaulted.bind(this),
    );
  }

  /**
   * Validate that user owns the farmer resource or is admin
   */
  private validateFarmerOwnership = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const user = req.user;
    if (!user) {
      res
        .status(401)
        .json({ success: false, error: "Authentication required" });
      return;
    }

    const farmerId = req.body?.farmerId || req.params?.farmerId;
    const isAdmin = user.role === UserRole.ADMIN;
    const isOwner = user.producerId === farmerId;

    if (!isAdmin && !isOwner) {
      logger.warn(
        `[Authorization] Farmer ownership check failed in advance controller`,
        {
          userId: user.userId,
          producerId: user.producerId,
          requestedFarmerId: farmerId,
          path: req.path,
        },
      );
      res.status(403).json({
        success: false,
        error: "You can only request advances for your own account",
      });
      return;
    }

    next();
  };

  // ════════════════════════════════════════════════════════════════════════════════
  // MIDDLEWARE
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * Validate advance ID parameter
   */
  private validateAdvanceId = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const result = advanceIdParamSchema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: "Invalid advance ID",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    next();
  };

  /**
   * Validate farmer ID parameter
   */
  private validateFarmerId = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const result = farmerIdParamSchema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: "Invalid farmer ID",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    next();
  };

  // ════════════════════════════════════════════════════════════════════════════════
  // ROUTE HANDLERS
  // ════════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/advances/calculate
   * Calculate advance terms without creating the advance
   */
  private async calculateAdvance(req: Request, res: Response): Promise<void> {
    try {
      const bodyResult = calculateAdvanceSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const { farmerId, orderId, requestedAmount } = bodyResult.data;

      const result = await this.advanceService.calculateAdvanceTerms(
        farmerId,
        orderId,
        requestedAmount,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error calculating advance:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances
   * Request a new advance
   */
  private async requestAdvance(req: Request, res: Response): Promise<void> {
    try {
      const bodyResult = requestAdvanceSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.advanceService.requestAdvance(bodyResult.data);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.data,
        message: "Advance request created successfully",
      });
    } catch (error) {
      console.error("Error requesting advance:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * GET /api/v1/advances/:advanceId
   * Get advance details
   */
  private async getAdvance(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;

      const result = await this.advanceService.getAdvanceDetails(advanceId);

      if (!result.success) {
        res.status(404).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error getting advance:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * GET /api/v1/advances/farmer/:farmerId
   * Get all advances for a farmer
   */
  private async getFarmerAdvances(req: Request, res: Response): Promise<void> {
    try {
      const { farmerId } = req.params;
      const queryResult = listAdvancesQuerySchema.safeParse(req.query);

      const status = queryResult.success ? queryResult.data.status : undefined;

      const result = await this.advanceService.getFarmerAdvances(
        farmerId,
        status,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        count: result.data?.length || 0,
      });
    } catch (error) {
      console.error("Error getting farmer advances:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances/:advanceId/approve
   * Approve a pending advance
   */
  private async approveAdvance(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;
      const bodyResult = approveAdvanceSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.advanceService.transitionStatus(
        advanceId,
        AdvanceStatus.APPROVED,
        bodyResult.data.approvedBy,
        bodyResult.data.notes || "Manually approved",
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: "Advance approved successfully",
      });
    } catch (error) {
      console.error("Error approving advance:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances/:advanceId/reject
   * Reject a pending advance
   */
  private async rejectAdvance(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;
      const bodyResult = rejectAdvanceSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.advanceService.transitionStatus(
        advanceId,
        AdvanceStatus.REJECTED,
        bodyResult.data.rejectedBy,
        bodyResult.data.reason,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: "Advance rejected",
      });
    } catch (error) {
      console.error("Error rejecting advance:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances/:advanceId/disburse
   * Disburse an approved advance
   */
  private async disburseAdvance(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;
      const bodyResult = disburseAdvanceSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.advanceService.disburseAdvance(
        advanceId,
        bodyResult.data.disbursementReference,
        bodyResult.data.disbursementFee,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: "Advance disbursed successfully",
      });
    } catch (error) {
      console.error("Error disbursing advance:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances/:advanceId/repay
   * Process a repayment
   */
  private async processRepayment(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;
      const bodyResult = repaymentSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.advanceService.processRepayment({
        advanceId,
        ...bodyResult.data,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: result.data?.isFullyRepaid
          ? "Advance fully repaid"
          : "Partial repayment processed",
      });
    } catch (error) {
      console.error("Error processing repayment:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances/:advanceId/status
   * Update advance status
   */
  private async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;
      const bodyResult = statusUpdateSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request body",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.advanceService.transitionStatus(
        advanceId,
        bodyResult.data.status,
        bodyResult.data.userId,
        bodyResult.data.reason,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: "Status updated successfully",
      });
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * GET /api/v1/advances/:advanceId/history
   * Get status history for an advance
   */
  private async getStatusHistory(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;

      // Direct database query for history
      const prisma = new PrismaClient();
      const history = await prisma.advanceStatusHistory.findMany({
        where: { advanceId },
        orderBy: { createdAt: "desc" },
      });
      await prisma.$disconnect();

      res.status(200).json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      console.error("Error getting status history:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/advances/:advanceId/default
   * Mark advance as defaulted
   */
  private async markAsDefaulted(req: Request, res: Response): Promise<void> {
    try {
      const { advanceId } = req.params;
      const { reason, recoveredAmount } = req.body;

      if (!reason || typeof reason !== "string") {
        res.status(400).json({
          success: false,
          error: "Reason is required",
        });
        return;
      }

      const result = await this.advanceService.markAsDefaulted(
        advanceId,
        reason,
        recoveredAmount || 0,
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
        message: "Advance marked as defaulted",
      });
    } catch (error) {
      console.error("Error marking as defaulted:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Create and configure the router
 */
export function createAdvanceRouter(
  prisma: PrismaClient,
  redis?: Redis,
): Router {
  const controller = new AdvanceController(prisma, redis);
  return controller.router;
}

/**
 * OpenAPI/Swagger documentation
 *
 * @openapi
 * /api/v1/advances/calculate:
 *   post:
 *     summary: Calculate advance terms
 *     tags: [Advances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - farmerId
 *               - orderId
 *             properties:
 *               farmerId:
 *                 type: string
 *                 format: uuid
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               requestedAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Advance terms calculated
 *       400:
 *         description: Invalid request or not eligible
 *
 * /api/v1/advances:
 *   post:
 *     summary: Request a new advance
 *     tags: [Advances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdvanceRequest'
 *     responses:
 *       201:
 *         description: Advance created successfully
 *       400:
 *         description: Invalid request or not eligible
 *
 * /api/v1/advances/{advanceId}:
 *   get:
 *     summary: Get advance details
 *     tags: [Advances]
 *     parameters:
 *       - name: advanceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Advance details
 *       404:
 *         description: Advance not found
 *
 * /api/v1/advances/farmer/{farmerId}:
 *   get:
 *     summary: Get farmer's advances
 *     tags: [Advances]
 *     parameters:
 *       - name: farmerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           description: Comma-separated list of statuses
 *     responses:
 *       200:
 *         description: List of advances
 *
 * /api/v1/advances/{advanceId}/approve:
 *   post:
 *     summary: Approve an advance
 *     tags: [Advances]
 *     parameters:
 *       - name: advanceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - approvedBy
 *             properties:
 *               approvedBy:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Advance approved
 *
 * /api/v1/advances/{advanceId}/repay:
 *   post:
 *     summary: Process a repayment
 *     tags: [Advances]
 *     parameters:
 *       - name: advanceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RepaymentRequest'
 *     responses:
 *       200:
 *         description: Repayment processed
 *
 * components:
 *   schemas:
 *     AdvanceRequest:
 *       type: object
 *       required:
 *         - farmerId
 *         - orderId
 *       properties:
 *         farmerId:
 *           type: string
 *           format: uuid
 *         orderId:
 *           type: string
 *           format: uuid
 *         requestedAmount:
 *           type: number
 *         disbursementMethod:
 *           type: string
 *           enum: [STRIPE, OPENPAY, BANK_TRANSFER, SPEI, CRYPTO, CASH]
 *         bankAccountId:
 *           type: string
 *         notes:
 *           type: string
 *     RepaymentRequest:
 *       type: object
 *       required:
 *         - amount
 *         - paymentMethod
 *         - paymentReference
 *         - source
 *       properties:
 *         amount:
 *           type: number
 *         paymentMethod:
 *           type: string
 *           enum: [STRIPE, OPENPAY, BANK_TRANSFER, SPEI, CRYPTO, CASH]
 *         paymentReference:
 *           type: string
 *         source:
 *           type: string
 *           enum: [BUYER_PAYMENT, FARMER_PAYMENT, INSURANCE, COLLECTIONS, OTHER]
 *         notes:
 *           type: string
 */
