/**
 * Credit Scoring Routes
 * Alternative credit assessment for farmers
 * @module credit-scoring/routes
 */

import { Router, Request, Response } from 'express';
import { simpleCreditScoringService } from '../simple-scoring.service.js';
import { logger } from '../../../infrastructure/logging/logger.js';

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /health - Credit scoring module health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    module: 'credit-scoring',
    modelVersion: 'v1.0-rules',
    timestamp: new Date().toISOString(),
    thresholds: {
      autoApproveHigh: { minScore: 700, maxAmount: 10000 },
      autoApproveLow: { minScore: 500, maxAmount: 5000 },
      manualReview: { minScore: 300 },
      autoReject: { maxScore: 299 },
    },
  });
});

// ============================================================================
// SCORING ROUTES
// ============================================================================

/**
 * GET /score/:userId - Calculate or retrieve credit score
 */
router.get('/score/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { recalculate = 'false' } = req.query;

    logger.info('[CreditScoring Route] Score request', {
      userId,
      recalculate,
    });

    let result;

    if (recalculate === 'true') {
      // Force recalculation
      result = await simpleCreditScoringService.calculateScore(userId);
    } else {
      // Try to get stored score first
      const storedScore = await simpleCreditScoringService.getStoredScore(userId);
      if (storedScore) {
        result = storedScore;
      } else {
        result = await simpleCreditScoringService.calculateScore(userId);
      }
    }

    res.json({
      success: true,
      score: result,
    });
  } catch (error) {
    logger.error('[CreditScoring Route] Score calculation failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /eligibility/:userId - Check eligibility for requested amount
 */
router.get('/eligibility/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { amount = '5000' } = req.query;

    const requestedAmount = parseFloat(amount as string);

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Must be a positive number.',
      });
    }

    logger.info('[CreditScoring Route] Eligibility check', {
      userId,
      requestedAmount,
    });

    const eligibility = await simpleCreditScoringService.checkEligibility(
      userId,
      requestedAmount
    );

    res.json({
      success: true,
      requestedAmount,
      ...eligibility,
    });
  } catch (error) {
    logger.error('[CreditScoring Route] Eligibility check failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /calculate/:userId - Force recalculate score
 */
router.post('/calculate/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    logger.info('[CreditScoring Route] Force recalculation', {
      userId,
      triggeredBy: req.user?.id || req.user?.userId,
    });

    const result = await simpleCreditScoringService.calculateScore(userId);

    res.json({
      success: true,
      score: result,
      message: 'Score recalculated successfully',
    });
  } catch (error) {
    logger.error('[CreditScoring Route] Recalculation failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /factors - Get scoring factors documentation
 */
router.get('/factors', (req: Request, res: Response) => {
  res.json({
    factors: [
      {
        name: 'Repayment History',
        weight: 0.40,
        maxScore: 400,
        description: 'Based on past advance repayment performance',
        metrics: ['totalAdvances', 'successfulRepayments', 'onTimeRate', 'avgDaysOverdue'],
      },
      {
        name: 'Transaction Frequency',
        weight: 0.20,
        maxScore: 200,
        description: 'Platform activity and sales volume',
        metrics: ['activeDays90', 'listingsCreated', 'totalSalesVolume', 'accountAgeDays'],
      },
      {
        name: 'Profile Completeness',
        weight: 0.15,
        maxScore: 150,
        description: 'Account verification and documentation',
        metrics: ['phoneVerified', 'locationAdded', 'idUploaded', 'bankLinked'],
      },
      {
        name: 'Request Pattern',
        weight: 0.15,
        maxScore: 150,
        description: 'Advance request behavior patterns',
        metrics: ['requestAmountRatio', 'daysSinceLastRequest', 'requestFrequency'],
      },
      {
        name: 'External Signals',
        weight: 0.10,
        maxScore: 100,
        description: 'Seasonal and regional factors',
        metrics: ['isHarvestSeason', 'cropRiskFactor', 'regionDefaultRate'],
      },
    ],
    scoreRange: { min: 0, max: 1000 },
    tiers: [
      { tier: 'A', range: '800-1000', description: 'Excellent' },
      { tier: 'B', range: '600-799', description: 'Good' },
      { tier: 'C', range: '400-599', description: 'Fair' },
      { tier: 'D', range: '0-399', description: 'Poor' },
    ],
  });
});

export default router;
