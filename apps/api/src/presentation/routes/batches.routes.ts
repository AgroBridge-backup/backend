import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validator.middleware.js";
import * as Prisma from "@prisma/client";
import { BatchUseCases } from "../../application/use-cases/batches/index.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { prisma } from "../../infrastructure/database/prisma/client.js";

export function createBatchesRouter(useCases: BatchUseCases) {
  const router = Router();

  /**
   * GET /api/v1/batches
   * List all batches for the authenticated user
   * For PRODUCER role: returns only their batches
   * For other roles: returns all batches
   */
  router.get(
    "/",
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const skip = (page - 1) * limit;

        // Build filter based on user role
        const where: Record<string, unknown> = {};
        if (user?.role === "PRODUCER" && user?.producerId) {
          where.producerId = user.producerId;
        }

        // Get total count and batches
        const [total, batches] = await Promise.all([
          prisma.batch.count({ where }),
          prisma.batch.findMany({
            where,
            include: {
              producer: {
                select: {
                  id: true,
                  businessName: true,
                  state: true,
                  municipality: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
        ]);

        res.status(200).json({
          success: true,
          data: batches,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Schema Definitions
  const createBatchSchema = z.object({
    body: z.object({
      // producerId will come from the authenticated user, not the body
      cropType: z.string(),
      variety: z.string(),
      quantity: z.number().positive(),
      harvestDate: z.coerce.date(),
      parcelName: z.string(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
  });

  /**
   * POST /api/v1/batches
   * Create a new batch
   * Rate limited: 50 creations per hour
   */
  router.post(
    "/",
    authenticate([Prisma.UserRole.PRODUCER]),
    RateLimiterConfig.creation(),
    validateRequest(createBatchSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const producerId = req.user?.producerId;
        if (!producerId) {
          // This check is correct, if token is valid but has no producerId, it's a client error
          return res.status(403).json({
            message: "User is not a producer or producer ID is missing.",
          });
        }
        const result = await useCases.createBatchUseCase.execute({
          ...req.body,
          producerId,
        });

        if (!result || !result.id) {
          return res.status(400).json({
            error: "Batch creation failed, use case returned invalid data.",
          });
        }

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id",
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.getBatchByIdUseCase.execute({
          id: req.params.id,
        });

        if (!result) {
          return res.status(404).json({ error: "Batch not found" });
        }

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/by-number/:batchNumber",
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.getBatchByNumberUseCase.execute({
          batchNumber: req.params.batchNumber,
        });
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id/history",
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.getBatchHistoryUseCase.execute({
          id: req.params.id,
        });
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
