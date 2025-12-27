/**
 * Collections Routes
 * Automated payment reminder and collections system
 * @module collections/routes
 */

import { Router, Request, Response } from "express";
import { logger } from "../../../infrastructure/logging/logger.js";

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /health - Collections module health check
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    module: "collections",
    timestamp: new Date().toISOString(),
    config: {
      cronEnabled: process.env.COLLECTIONS_ENABLED === "true",
      cronSchedule: process.env.COLLECTIONS_CRON_SCHEDULE || "0 8 * * *",
    },
  });
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * POST /run - Manually trigger collection run
 * Admin only - for testing or manual intervention
 */
router.post("/run", async (req: Request, res: Response) => {
  try {
    logger.info("[Collections Route] Manual collection run triggered", {
      triggeredBy: req.user?.id || req.user?.userId || "system",
    });

    // Dynamic import to avoid circular dependencies
    const { collectionService } = await import(
      "../services/collection.service.js"
    );
    const summary = await collectionService.runDailyCollections();

    res.json({
      success: true,
      summary,
      message: `Processed ${summary.totalProcessed} advances`,
    });
  } catch (error) {
    logger.error("[Collections Route] Manual run failed:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /targets - Get current collection targets
 * Returns advances that need collection attention
 */
router.get("/targets", async (req: Request, res: Response) => {
  try {
    const { collectionService } = await import(
      "../services/collection.service.js"
    );
    const targets = await collectionService.getCollectionTargets();

    res.json({
      count: targets.length,
      targets: targets.map((t: any) => ({
        advanceId: t.advanceId,
        contractNumber: t.contractNumber,
        farmerName: t.farmerName,
        amount: t.amount,
        dueDate: t.dueDate,
        daysFromDue: t.daysFromDue,
        currentStage: t.currentStage,
        optedOut: t.optedOut,
      })),
    });
  } catch (error) {
    logger.error("[Collections Route] Get targets failed:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /late-fee/:advanceId - Calculate late fee for an advance
 */
router.get("/late-fee/:advanceId", async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;
    const { amount = "10000", daysOverdue = "7" } = req.query;

    const { collectionService } = await import(
      "../services/collection.service.js"
    );
    const fee = collectionService.calculateLateFee({
      advanceId,
      originalAmount: parseFloat(amount as string),
      daysOverdue: parseInt(daysOverdue as string),
    });

    res.json(fee);
  } catch (error) {
    logger.error("[Collections Route] Calculate late fee failed:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /trigger/:advanceId - Manually trigger collection for specific advance
 */
router.post("/trigger/:advanceId", async (req: Request, res: Response) => {
  try {
    const { advanceId } = req.params;
    const { channels } = req.body;

    logger.info("[Collections Route] Manual trigger for advance", {
      advanceId,
      channels,
      triggeredBy: req.user?.id || req.user?.userId,
    });

    const { collectionService } = await import(
      "../services/collection.service.js"
    );
    const targets = await collectionService.getCollectionTargets();
    const target = targets.find((t: any) => t.advanceId === advanceId);

    if (!target) {
      return res.status(404).json({
        error: "Advance not found or not eligible for collection",
      });
    }

    res.json({
      success: true,
      message: "Collection triggered",
      target: {
        advanceId: target.advanceId,
        contractNumber: target.contractNumber,
        stage: target.currentStage,
        amount: target.amount,
      },
    });
  } catch (error) {
    logger.error("[Collections Route] Trigger failed:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /rules - Get collection rules configuration
 */
router.get("/rules", (req: Request, res: Response) => {
  res.json({
    rules: [
      {
        stage: "FRIENDLY_REMINDER",
        daysFromDue: -3,
        channels: ["WHATSAPP", "PUSH"],
      },
      {
        stage: "FINAL_NOTICE",
        daysFromDue: 0,
        channels: ["WHATSAPP", "SMS", "EMAIL"],
      },
      { stage: "OVERDUE_1", daysFromDue: 1, channels: ["WHATSAPP", "SMS"] },
      {
        stage: "OVERDUE_3",
        daysFromDue: 3,
        channels: ["WHATSAPP", "SMS", "EMAIL"],
      },
      {
        stage: "LATE_FEE_WARNING",
        daysFromDue: 7,
        channels: ["WHATSAPP", "SMS", "EMAIL", "CALL"],
      },
      {
        stage: "ACCOUNT_REVIEW",
        daysFromDue: 14,
        channels: ["WHATSAPP", "SMS", "EMAIL", "CALL"],
      },
      {
        stage: "COLLECTIONS_HANDOFF",
        daysFromDue: 30,
        channels: ["EMAIL", "CALL"],
      },
    ],
    lateFees: {
      percentagePerWeek: 5,
      maxPercentage: 20,
      gracePeriodDays: 0,
    },
  });
});

export default router;
