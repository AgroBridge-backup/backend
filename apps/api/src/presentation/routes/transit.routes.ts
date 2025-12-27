/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * API Routes for Transit Session Management
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validator.middleware.js";
import { UserRole, TransitStatus } from "@prisma/client";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { CreateTransitSessionUseCase } from "../../application/use-cases/transit/CreateTransitSessionUseCase.js";
import { GetTransitSessionUseCase } from "../../application/use-cases/transit/GetTransitSessionUseCase.js";
import { UpdateTransitStatusUseCase } from "../../application/use-cases/transit/UpdateTransitStatusUseCase.js";
import { AddLocationUpdateUseCase } from "../../application/use-cases/transit/AddLocationUpdateUseCase.js";
import { GetLocationHistoryUseCase } from "../../application/use-cases/transit/GetLocationHistoryUseCase.js";
import { TransitTrackingService } from "../../domain/services/TransitTrackingService.js";

export interface TransitUseCases {
  createTransitSessionUseCase: CreateTransitSessionUseCase;
  getTransitSessionUseCase: GetTransitSessionUseCase;
  updateTransitStatusUseCase: UpdateTransitStatusUseCase;
  addLocationUpdateUseCase: AddLocationUpdateUseCase;
  getLocationHistoryUseCase: GetLocationHistoryUseCase;
  transitService: TransitTrackingService;
}

export function createTransitRouter(useCases?: TransitUseCases): Router {
  const router = Router();

  // Guard: Return empty router if use cases not provided
  if (!useCases) {
    return router;
  }

  // Schema Definitions
  const createSessionSchema = z.object({
    body: z.object({
      vehicleId: z.string().optional(),
      originName: z.string().min(1).max(255),
      originLat: z.number().min(-90).max(90),
      originLng: z.number().min(-180).max(180),
      destinationName: z.string().min(1).max(255),
      destinationLat: z.number().min(-90).max(90),
      destinationLng: z.number().min(-180).max(180),
      scheduledDeparture: z.string().datetime().optional(),
      scheduledArrival: z.string().datetime().optional(),
      totalDistanceKm: z.number().positive().optional(),
      maxDeviationKm: z.number().positive().max(50).optional(),
      alertOnDeviation: z.boolean().optional(),
    }),
    params: z.object({
      id: z.string().uuid(),
    }),
  });

  const updateStatusSchema = z.object({
    body: z.object({
      status: z.nativeEnum(TransitStatus),
    }),
    params: z.object({
      sessionId: z.string().uuid(),
    }),
  });

  const addLocationSchema = z.object({
    body: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitude: z.number().optional(),
      accuracy: z.number().positive().optional(),
      speed: z.number().min(0).optional(),
      heading: z.number().min(0).max(360).optional(),
      address: z.string().optional(),
    }),
    params: z.object({
      sessionId: z.string().uuid(),
    }),
  });

  const sessionIdSchema = z.object({
    params: z.object({
      sessionId: z.string().uuid(),
    }),
  });

  const batchIdSchema = z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
  });

  /**
   * POST /api/v1/batches/:id/transit
   * Create a new transit session for a batch
   * Requires DRIVER or ADMIN role
   */
  router.post(
    "/batches/:id/transit",
    authenticate([UserRole.DRIVER, UserRole.ADMIN]),
    RateLimiterConfig.creation(),
    validateRequest(createSessionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await useCases.createTransitSessionUseCase.execute({
          batchId: req.params.id,
          driverId: req.user!.userId,
          vehicleId: req.body.vehicleId,
          originName: req.body.originName,
          originLat: req.body.originLat,
          originLng: req.body.originLng,
          destinationName: req.body.destinationName,
          destinationLat: req.body.destinationLat,
          destinationLng: req.body.destinationLng,
          scheduledDeparture: req.body.scheduledDeparture
            ? new Date(req.body.scheduledDeparture)
            : undefined,
          scheduledArrival: req.body.scheduledArrival
            ? new Date(req.body.scheduledArrival)
            : undefined,
          totalDistanceKm: req.body.totalDistanceKm,
          maxDeviationKm: req.body.maxDeviationKm,
          alertOnDeviation: req.body.alertOnDeviation,
        });

        res.status(201).json({
          success: true,
          data: session,
          message: "Transit session created successfully.",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/batches/:id/transit
   * Get all transit sessions for a batch
   */
  router.get(
    "/batches/:id/transit",
    authenticate(),
    validateRequest(batchIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessions = await useCases.transitService.getBatchSessions(
          req.params.id,
        );

        res.status(200).json({
          success: true,
          data: {
            sessions,
            count: sessions.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/transit/:sessionId
   * Get transit session details with progress
   */
  router.get(
    "/transit/:sessionId",
    authenticate(),
    validateRequest(sessionIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await useCases.getTransitSessionUseCase.execute({
          sessionId: req.params.sessionId,
        });

        res.status(200).json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/v1/transit/:sessionId/status
   * Update transit session status
   * Requires DRIVER or ADMIN role
   */
  router.patch(
    "/transit/:sessionId/status",
    authenticate([UserRole.DRIVER, UserRole.ADMIN]),
    validateRequest(updateStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await useCases.updateTransitStatusUseCase.execute({
          sessionId: req.params.sessionId,
          status: req.body.status,
          userId: req.user!.userId,
        });

        res.status(200).json({
          success: true,
          data: session,
          message: `Transit status updated to ${req.body.status}.`,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/transit/:sessionId/start
   * Start transit (shorthand for status update)
   */
  router.post(
    "/transit/:sessionId/start",
    authenticate([UserRole.DRIVER, UserRole.ADMIN]),
    validateRequest(sessionIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await useCases.transitService.startTransit(
          req.params.sessionId,
          req.user!.userId,
        );

        res.status(200).json({
          success: true,
          data: session,
          message: "Transit started.",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/transit/:sessionId/complete
   * Complete transit
   */
  router.post(
    "/transit/:sessionId/complete",
    authenticate([UserRole.DRIVER, UserRole.ADMIN]),
    validateRequest(sessionIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await useCases.transitService.completeTransit(
          req.params.sessionId,
          req.user!.userId,
        );

        res.status(200).json({
          success: true,
          data: session,
          message: "Transit completed.",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/transit/:sessionId/location
   * Add a GPS location update
   * Rate limited to prevent excessive updates
   */
  router.post(
    "/transit/:sessionId/location",
    authenticate([UserRole.DRIVER, UserRole.ADMIN]),
    RateLimiterConfig.api(), // Limit to 60/min
    validateRequest(addLocationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.addLocationUpdateUseCase.execute({
          sessionId: req.params.sessionId,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          altitude: req.body.altitude,
          accuracy: req.body.accuracy,
          speed: req.body.speed,
          heading: req.body.heading,
          address: req.body.address,
        });

        res.status(201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/transit/:sessionId/locations
   * Get location history for a session
   */
  router.get(
    "/transit/:sessionId/locations",
    authenticate(),
    validateRequest(sessionIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : 100;
        const locations = await useCases.getLocationHistoryUseCase.execute({
          sessionId: req.params.sessionId,
          limit,
        });

        res.status(200).json({
          success: true,
          data: {
            locations,
            count: locations.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/transit/:sessionId/current-location
   * Get the current (latest) location for a session
   */
  router.get(
    "/transit/:sessionId/current-location",
    authenticate(),
    validateRequest(sessionIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const location = await useCases.transitService.getCurrentLocation(
          req.params.sessionId,
        );

        res.status(200).json({
          success: true,
          data: location,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/drivers/me/transit
   * Get active transit sessions for the current driver
   */
  router.get(
    "/drivers/me/transit",
    authenticate([UserRole.DRIVER, UserRole.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessions = await useCases.transitService.getDriverActiveSessions(
          req.user!.userId,
        );

        res.status(200).json({
          success: true,
          data: {
            sessions,
            count: sessions.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
