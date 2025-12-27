/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - CREDIT SCORE CONTROLLER
 * RESTful API Endpoints for Credit Scoring
 *
 * Endpoints:
 * - GET    /api/v1/credit-scores/:producerId - Get credit score
 * - POST   /api/v1/credit-scores/:producerId/calculate - Calculate/recalculate score
 * - GET    /api/v1/credit-scores/:producerId/history - Get score history
 * - POST   /api/v1/credit-scores/:producerId/simulate - Simulate score changes
 * - GET    /api/v1/credit-scores/:producerId/eligibility - Check eligibility
 * - POST   /api/v1/credit-scores/:producerId/sync - Sync blockchain data
 *
 * @module cash-flow-bridge/controllers
 * @version 1.0.0
 * @author Marcus Chen (Stripe Treasury Engineer)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction, Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import {
  CreditScoringService,
  createCreditScoringService,
} from "../../credit-scoring/services/credit-scoring.service.js";
import {
  BlockchainVerifierService,
  createBlockchainVerifierService,
} from "../../credit-scoring/services/blockchain-verifier.service.js";
import {
  RiskTier,
  ScoreSimulationInput,
} from "../../credit-scoring/types/credit-score.types.js";

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const producerIdParamSchema = z.object({
  producerId: z.string().uuid("Invalid producer ID format"),
});

const calculateScoreQuerySchema = z.object({
  forceRecalculate: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  includeDetails: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const simulationBodySchema = z.object({
  additionalSuccessfulDeliveries: z.number().int().min(0).optional(),
  additionalDefaultedDeliveries: z.number().int().min(0).optional(),
  qualityImprovement: z.number().min(-100).max(100).optional(),
  completedAdvanceRepayments: z.number().int().min(0).optional(),
  additionalBlockchainVerifications: z.number().int().min(0).optional(),
});

const eligibilityQuerySchema = z.object({
  requestedAmount: z.coerce.number().positive("Amount must be positive"),
  orderId: z.string().uuid("Invalid order ID format"),
});

// ════════════════════════════════════════════════════════════════════════════════
// CONTROLLER CLASS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Credit Score Controller
 *
 * Handles all HTTP requests related to credit scoring.
 */
export class CreditScoreController {
  private readonly creditScoringService: CreditScoringService;
  private readonly blockchainVerifier: BlockchainVerifierService;
  public readonly router: Router;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.creditScoringService = createCreditScoringService(prisma, redis);
    this.blockchainVerifier = createBlockchainVerifierService(prisma);
    this.router = Router();
    this.initializeRoutes();
  }

  /**
   * Initialize all routes
   */
  private initializeRoutes(): void {
    // GET /api/v1/credit-scores/:producerId
    this.router.get(
      "/:producerId",
      this.validateProducerId,
      this.getCreditScore.bind(this),
    );

    // POST /api/v1/credit-scores/:producerId/calculate
    this.router.post(
      "/:producerId/calculate",
      this.validateProducerId,
      this.calculateCreditScore.bind(this),
    );

    // GET /api/v1/credit-scores/:producerId/history
    this.router.get(
      "/:producerId/history",
      this.validateProducerId,
      this.getScoreHistory.bind(this),
    );

    // POST /api/v1/credit-scores/:producerId/simulate
    this.router.post(
      "/:producerId/simulate",
      this.validateProducerId,
      this.simulateScore.bind(this),
    );

    // GET /api/v1/credit-scores/:producerId/eligibility
    this.router.get(
      "/:producerId/eligibility",
      this.validateProducerId,
      this.checkEligibility.bind(this),
    );

    // POST /api/v1/credit-scores/:producerId/sync
    this.router.post(
      "/:producerId/sync",
      this.validateProducerId,
      this.syncBlockchainData.bind(this),
    );

    // GET /api/v1/credit-scores/:producerId/summary
    this.router.get(
      "/:producerId/summary",
      this.validateProducerId,
      this.getScoreSummary.bind(this),
    );
  }

  /**
   * Middleware: Validate producer ID parameter
   */
  private validateProducerId = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const result = producerIdParamSchema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: "Invalid producer ID",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    next();
  };

  /**
   * GET /api/v1/credit-scores/:producerId
   * Get credit score for a producer
   */
  private async getCreditScore(req: Request, res: Response): Promise<void> {
    try {
      const { producerId } = req.params;
      const queryResult = calculateScoreQuerySchema.safeParse(req.query);

      const forceRecalculate = queryResult.success
        ? (queryResult.data.forceRecalculate ?? false)
        : false;
      const includeDetails = queryResult.success
        ? (queryResult.data.includeDetails ?? true)
        : true;

      const result = await this.creditScoringService.calculateScore({
        producerId,
        forceRecalculate,
        includeDetails,
      });

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
        cached: result.cached,
        cacheTtl: result.cacheTtl,
      });
    } catch (error) {
      console.error("Error getting credit score:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/credit-scores/:producerId/calculate
   * Force recalculate credit score
   */
  private async calculateCreditScore(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { producerId } = req.params;

      const result = await this.creditScoringService.calculateScore({
        producerId,
        forceRecalculate: true,
        includeDetails: true,
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
        message: "Credit score recalculated successfully",
      });
    } catch (error) {
      console.error("Error calculating credit score:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * GET /api/v1/credit-scores/:producerId/history
   * Get score history
   */
  private async getScoreHistory(req: Request, res: Response): Promise<void> {
    try {
      const { producerId } = req.params;
      const queryResult = historyQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const history = await this.creditScoringService.getScoreHistory(
        producerId,
        queryResult.data.limit,
      );

      res.status(200).json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      console.error("Error getting score history:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/credit-scores/:producerId/simulate
   * Simulate score changes
   */
  private async simulateScore(req: Request, res: Response): Promise<void> {
    try {
      const { producerId } = req.params;
      const bodyResult = simulationBodySchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid simulation parameters",
          details: bodyResult.error.flatten().fieldErrors,
        });
        return;
      }

      const input: ScoreSimulationInput = {
        producerId,
        changes: bodyResult.data,
      };

      const result = await this.creditScoringService.simulateScore(input);

      if (!result) {
        res.status(404).json({
          success: false,
          error:
            "Could not simulate score. Producer may not have a credit score yet.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error simulating score:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * GET /api/v1/credit-scores/:producerId/eligibility
   * Check eligibility for an advance
   */
  private async checkEligibility(req: Request, res: Response): Promise<void> {
    try {
      const { producerId } = req.params;
      const queryResult = eligibilityQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: "Invalid eligibility check parameters",
          details: queryResult.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await this.creditScoringService.checkEligibility({
        producerId,
        requestedAmount: queryResult.data.requestedAmount,
        orderId: queryResult.data.orderId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error checking eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * POST /api/v1/credit-scores/:producerId/sync
   * Sync blockchain data
   */
  private async syncBlockchainData(req: Request, res: Response): Promise<void> {
    try {
      const { producerId } = req.params;

      // Check if blockchain verification is available
      if (!this.blockchainVerifier.isAvailable()) {
        res.status(503).json({
          success: false,
          error: "Blockchain verification service is not available",
        });
        return;
      }

      const result =
        await this.blockchainVerifier.syncBlockchainData(producerId);

      // Invalidate cache after sync
      await this.creditScoringService.invalidateCache(producerId);

      res.status(200).json({
        success: true,
        data: {
          recordsSynced: result.synced,
          errors: result.errors,
          message: `Synced ${result.synced} blockchain records`,
        },
      });
    } catch (error) {
      console.error("Error syncing blockchain data:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * GET /api/v1/credit-scores/:producerId/summary
   * Get score summary for dashboard
   */
  private async getScoreSummary(req: Request, res: Response): Promise<void> {
    try {
      const { producerId } = req.params;

      const summary =
        await this.creditScoringService.getScoreSummary(producerId);

      if (!summary) {
        res.status(404).json({
          success: false,
          error: "Credit score not found for this producer",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("Error getting score summary:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}

/**
 * Create and configure the router
 */
export function createCreditScoreRouter(
  prisma: PrismaClient,
  redis?: Redis,
): Router {
  const controller = new CreditScoreController(prisma, redis);
  return controller.router;
}

/**
 * OpenAPI/Swagger documentation
 *
 * @openapi
 * /api/v1/credit-scores/{producerId}:
 *   get:
 *     summary: Get credit score for a producer
 *     tags: [Credit Scoring]
 *     parameters:
 *       - name: producerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: forceRecalculate
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *       - name: includeDetails
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Credit score retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditScoreResponse'
 *       404:
 *         description: Producer not found
 *
 * /api/v1/credit-scores/{producerId}/calculate:
 *   post:
 *     summary: Force recalculate credit score
 *     tags: [Credit Scoring]
 *     parameters:
 *       - name: producerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Credit score recalculated successfully
 *
 * /api/v1/credit-scores/{producerId}/history:
 *   get:
 *     summary: Get score history
 *     tags: [Credit Scoring]
 *     parameters:
 *       - name: producerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Score history retrieved
 *
 * /api/v1/credit-scores/{producerId}/eligibility:
 *   get:
 *     summary: Check eligibility for an advance
 *     tags: [Credit Scoring]
 *     parameters:
 *       - name: producerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: requestedAmount
 *         in: query
 *         required: true
 *         schema:
 *           type: number
 *       - name: orderId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Eligibility check result
 *
 * components:
 *   schemas:
 *     CreditScoreResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/CreditScore'
 *         cached:
 *           type: boolean
 *     CreditScore:
 *       type: object
 *       properties:
 *         producerId:
 *           type: string
 *         overallScore:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         riskTier:
 *           type: string
 *           enum: [A, B, C]
 *         componentScores:
 *           type: object
 *         creditLimits:
 *           type: object
 *         trend:
 *           type: string
 *           enum: [IMPROVING, STABLE, DECLINING]
 */
