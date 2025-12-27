/**
 * Cold Chain Routes
 *
 * REST API endpoints for IoT-enabled cold chain monitoring.
 *
 * @module ColdChainRoutes
 */

import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ColdChainService } from "../../domain/services/ColdChainService.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";

// ════════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════════════════════════

const RegisterSensorSchema = z.object({
  deviceId: z.string().min(1),
  deviceType: z.enum([
    "TEMP_HUMIDITY",
    "BRIX_METER",
    "MULTIFUNCTION",
    "PH_METER",
  ]),
  name: z.string().optional(),
  manufacturer: z.string().optional(),
  firmwareVersion: z.string().optional(),
});

const StartSessionSchema = z.object({
  sessionType: z.enum([
    "FIELD_MONITORING",
    "HARVEST_COOLING",
    "COLD_STORAGE",
    "TRANSPORT",
  ]),
  cropType: z.enum([
    "AVOCADO",
    "BLUEBERRY",
    "STRAWBERRY",
    "RASPBERRY",
    "COFFEE",
    "CACAO",
  ]),
  sensorIds: z.array(z.string()).min(1),
  fieldId: z.string().optional(),
  batchId: z.string().optional(),
  shipmentId: z.string().optional(),
  certificateId: z.string().optional(),
});

const RecordReadingSchema = z.object({
  sensorId: z.string(),
  sessionId: z.string().optional(),
  temperature: z.number().min(-40).max(100),
  humidity: z.number().min(0).max(100).optional(),
  brixLevel: z.number().min(0).max(30).optional(),
  phLevel: z.number().min(0).max(14).optional(),
  firmness: z.number().min(0).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLon: z.number().min(-180).max(180).optional(),
  readingTime: z.string().datetime().optional(),
});

const AssignSensorSchema = z.object({
  assignedTo: z.string(),
  assignedType: z.enum(["FIELD", "BATCH", "SHIPMENT", "STORAGE"]),
});

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER FACTORY
// ════════════════════════════════════════════════════════════════════════════════

export function createColdChainRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = new ColdChainService(prisma);

  // Apply auth middleware to all routes
  router.use(authenticate());

  // ══════════════════════════════════════════════════════════════════════════════
  // SENSOR ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /cold-chain/sensors
   * Register a new IoT sensor
   */
  router.post(
    "/sensors",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const data = RegisterSensorSchema.parse(req.body);

        const sensor = await service.registerSensor({
          ...data,
          exportCompanyId,
        });

        res.status(201).json({
          success: true,
          data: sensor,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cold-chain/sensors
   * List sensors for the export company
   */
  router.get(
    "/sensors",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const { status, assignedType, limit, offset } = req.query;

        const result = await service.listSensors(exportCompanyId, {
          status: status as string,
          assignedType: assignedType as string,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        });

        res.json({
          success: true,
          data: result.sensors,
          meta: { total: result.total },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cold-chain/sensors/:id
   * Get sensor by ID
   */
  router.get(
    "/sensors/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sensor = await service.getSensor(req.params.id);

        res.json({
          success: true,
          data: sensor,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /cold-chain/sensors/:id/assign
   * Assign sensor to field/batch/shipment
   */
  router.patch(
    "/sensors/:id/assign",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = AssignSensorSchema.parse(req.body);

        const sensor = await service.assignSensor(
          req.params.id,
          data.assignedTo,
          data.assignedType,
        );

        res.json({
          success: true,
          data: sensor,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /cold-chain/sensors/:id/status
   * Update sensor status
   */
  router.patch(
    "/sensors/:id/status",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status } = req.body;

        if (
          ![
            "ACTIVE",
            "OFFLINE",
            "LOW_BATTERY",
            "MAINTENANCE",
            "DECOMMISSIONED",
          ].includes(status)
        ) {
          throw new AppError("Invalid status", 400);
        }

        const sensor = await service.updateSensorStatus(req.params.id, status);

        res.json({
          success: true,
          data: sensor,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // SESSION ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /cold-chain/sessions
   * Start a new cold chain monitoring session
   */
  router.post(
    "/sessions",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const data = StartSessionSchema.parse(req.body);

        const session = await service.startSession({
          ...data,
          exportCompanyId,
        } as any);

        res.status(201).json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cold-chain/sessions
   * List sessions for the export company
   */
  router.get(
    "/sessions",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const { status, sessionType, cropType, limit, offset } = req.query;

        const result = await service.listSessions(exportCompanyId, {
          status: status as string,
          sessionType: sessionType as string,
          cropType: cropType as string,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        });

        res.json({
          success: true,
          data: result.sessions,
          meta: { total: result.total },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cold-chain/sessions/:id
   * Get session by ID
   */
  router.get(
    "/sessions/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const session = await service.getSession(req.params.id);

        res.json({
          success: true,
          data: session,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /cold-chain/sessions/:id/end
   * End a cold chain session
   */
  router.post(
    "/sessions/:id/end",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.endSession(req.params.id);

        const session = await service.getSession(req.params.id);

        res.json({
          success: true,
          data: session,
          message: "Session ended successfully",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cold-chain/sessions/:id/readings
   * Get readings for a session
   */
  router.get(
    "/sessions/:id/readings",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit, offset, startTime, endTime } = req.query;

        const result = await service.getSessionReadings(req.params.id, {
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
          startTime: startTime ? new Date(startTime as string) : undefined,
          endTime: endTime ? new Date(endTime as string) : undefined,
        });

        res.json({
          success: true,
          data: result.readings,
          meta: { total: result.total },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cold-chain/sessions/:id/report
   * Get compliance report for a session
   */
  router.get(
    "/sessions/:id/report",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const report = await service.getComplianceReport(req.params.id);

        res.json({
          success: true,
          data: report,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // READING ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /cold-chain/readings
   * Record a sensor reading
   */
  router.post(
    "/readings",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = RecordReadingSchema.parse(req.body);

        const reading = await service.recordReading({
          ...data,
          readingTime: data.readingTime
            ? new Date(data.readingTime)
            : undefined,
        });

        res.status(201).json({
          success: true,
          data: reading,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /cold-chain/readings/bulk
   * Record multiple sensor readings (for batch uploads)
   */
  router.post(
    "/readings/bulk",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { readings } = req.body;

        if (!Array.isArray(readings) || readings.length === 0) {
          throw new AppError("readings array is required", 400);
        }

        if (readings.length > 100) {
          throw new AppError("Maximum 100 readings per request", 400);
        }

        const results = await Promise.all(
          readings.map(async (reading: any) => {
            try {
              const validated = RecordReadingSchema.parse(reading);
              return await service.recordReading({
                ...validated,
                readingTime: validated.readingTime
                  ? new Date(validated.readingTime)
                  : undefined,
              });
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : "Unknown error",
                input: reading,
              };
            }
          }),
        );

        const successful = results.filter((r) => !("error" in r));
        const failed = results.filter((r) => "error" in r);

        res.status(201).json({
          success: true,
          data: {
            recorded: successful.length,
            failed: failed.length,
            errors: failed,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // DASHBOARD ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /cold-chain/dashboard
   * Get dashboard stats for the export company
   */
  router.get(
    "/dashboard",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exportCompanyId = req.user?.exportCompanyAdminId;
        if (!exportCompanyId) {
          throw new AppError("Export company context required", 403);
        }

        const stats = await service.getDashboardStats(exportCompanyId);

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

// ════════════════════════════════════════════════════════════════════════════════
// WEBHOOK ROUTER (for IoT device callbacks - no auth)
// ════════════════════════════════════════════════════════════════════════════════

export function createColdChainWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();
  const service = new ColdChainService(prisma);

  /**
   * POST /webhooks/cold-chain/readings
   * Receive sensor readings from IoT devices
   * Protected by API key in header
   */
  router.post(
    "/readings",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers["x-api-key"];

        if (!apiKey) {
          throw new AppError("API key required", 401);
        }

        // Validate API key
        const keyRecord = await prisma.apiKey.findFirst({
          where: {
            keyHash: apiKey as string, // In production, hash the incoming key
            status: "ACTIVE",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });

        if (!keyRecord) {
          throw new AppError("Invalid API key", 401);
        }

        // Parse reading
        const data = RecordReadingSchema.parse(req.body);

        const reading = await service.recordReading({
          ...data,
          readingTime: data.readingTime
            ? new Date(data.readingTime)
            : undefined,
        });

        // Update API key usage
        await prisma.apiKey.update({
          where: { id: keyRecord.id },
          data: {
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
          },
        });

        res.status(201).json({
          success: true,
          data: { id: reading.id },
        });
      } catch (error) {
        logger.error("[ColdChain Webhook] Error processing reading", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        next(error);
      }
    },
  );

  return router;
}
