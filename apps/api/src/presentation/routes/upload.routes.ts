/**
 * @file Upload Routes
 * @description Routes for file upload operations
 *
 * @author AgroBridge Engineering Team
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as Prisma from "@prisma/client";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validator.middleware.js";
import {
  uploadImage,
  uploadAvatar,
  uploadDocument,
  uploadCertificate,
} from "../../infrastructure/http/middleware/upload.middleware.js";
import {
  storageService,
  type UploadType,
} from "../../infrastructure/storage/index.js";
import logger from "../../shared/utils/logger.js";

export function createUploadRouter(): Router {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRESIGNED URL ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/uploads/presigned
   * Get presigned URL for direct client upload to S3
   */
  const presignedSchema = z.object({
    body: z.object({
      filename: z.string().min(1).max(255),
      contentType: z.string().min(1),
      type: z
        .enum([
          "image",
          "document",
          "certificate",
          "avatar",
          "batch_photo",
          "general",
        ])
        .optional(),
      prefix: z.string().max(255).optional(),
    }),
  });

  router.post(
    "/presigned",
    authenticate(),
    validateRequest(presignedSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { filename, contentType, type = "general", prefix } = req.body;

        const result = await storageService.getPresignedUploadUrl({
          filename,
          contentType,
          type: type as UploadType,
          prefix,
          expiresIn: 3600, // 1 hour
          metadata: {
            uploadedBy: req.user?.userId || "unknown",
          },
        });

        if (!result.validation.valid) {
          return res.status(400).json({
            error: "Validation failed",
            details: result.validation.errors,
          });
        }

        res.status(200).json({
          uploadUrl: result.uploadUrl,
          downloadUrl: result.downloadUrl,
          key: result.key,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // DIRECT UPLOAD ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/uploads/image
   * Upload an image directly
   */
  router.post(
    "/image",
    authenticate(),
    uploadImage.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const result = await storageService.upload(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          {
            type: "image",
            optimize: true,
            generateThumbnail: req.query.thumbnail === "true",
            generateResponsive: req.query.responsive === "true",
            metadata: {
              uploadedBy: req.user?.userId || "unknown",
            },
          },
        );

        if (!result.success) {
          return res.status(400).json({
            error: result.error,
            validation: result.validation,
          });
        }

        logger.info({
          message: "Image uploaded via API",
          meta: { key: result.file?.key, userId: req.user?.userId },
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/uploads/avatar
   * Upload user avatar
   */
  router.post(
    "/avatar",
    authenticate(),
    uploadAvatar.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: "User ID not found" });
        }

        const result = await storageService.uploadAvatar(
          req.file.buffer,
          req.file.originalname,
          userId,
        );

        if (!result.success) {
          return res.status(400).json({
            error: result.error,
            validation: result.validation,
          });
        }

        logger.info({
          message: "Avatar uploaded",
          meta: { key: result.file?.key, userId },
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/uploads/batch/:batchId/photo
   * Upload batch photo (producers only)
   */
  router.post(
    "/batch/:batchId/photo",
    authenticate([Prisma.UserRole.PRODUCER]),
    uploadImage.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const { batchId } = req.params;

        const result = await storageService.uploadBatchPhoto(
          req.file.buffer,
          req.file.originalname,
          batchId,
        );

        if (!result.success) {
          return res.status(400).json({
            error: result.error,
            validation: result.validation,
          });
        }

        logger.info({
          message: "Batch photo uploaded",
          meta: { key: result.file?.key, batchId, userId: req.user?.userId },
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/uploads/certificate
   * Upload certification document (producers only)
   */
  router.post(
    "/certificate",
    authenticate([Prisma.UserRole.PRODUCER]),
    uploadCertificate.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const producerId = req.user?.producerId;
        if (!producerId) {
          return res.status(403).json({ error: "Producer ID not found" });
        }

        const result = await storageService.uploadCertificate(
          req.file.buffer,
          req.file.originalname,
          producerId,
          req.file.mimetype,
        );

        if (!result.success) {
          return res.status(400).json({
            error: result.error,
            validation: result.validation,
          });
        }

        logger.info({
          message: "Certificate uploaded",
          meta: { key: result.file?.key, producerId, userId: req.user?.userId },
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/uploads/document
   * Upload general document
   */
  router.post(
    "/document",
    authenticate(),
    uploadDocument.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const result = await storageService.upload(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          {
            type: "document",
            optimize: false,
            metadata: {
              uploadedBy: req.user?.userId || "unknown",
            },
          },
        );

        if (!result.success) {
          return res.status(400).json({
            error: result.error,
            validation: result.validation,
          });
        }

        logger.info({
          message: "Document uploaded",
          meta: { key: result.file?.key, userId: req.user?.userId },
        });

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/uploads/download/:key(*)
   * Get presigned download URL for a file
   */
  router.get(
    "/download/*",
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params[0];

        if (!key) {
          return res.status(400).json({ error: "File key is required" });
        }

        const exists = await storageService.exists(key);
        if (!exists) {
          return res.status(404).json({ error: "File not found" });
        }

        const downloadUrl = await storageService.getPresignedDownloadUrl(key);

        res.status(200).json({ downloadUrl, expiresIn: 3600 });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * DELETE /api/v1/uploads/:key(*)
   * Delete a file (admin only)
   */
  router.delete(
    "/*",
    authenticate([Prisma.UserRole.ADMIN]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params[0];

        if (!key) {
          return res.status(400).json({ error: "File key is required" });
        }

        const exists = await storageService.exists(key);
        if (!exists) {
          return res.status(404).json({ error: "File not found" });
        }

        // Delete with variants (thumbnails, responsive images)
        await storageService.deleteWithVariants(key);

        logger.info({
          message: "File deleted",
          meta: { key, userId: req.user?.userId },
        });

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/uploads/metadata/:key(*)
   * Get file metadata
   */
  router.get(
    "/metadata/*",
    authenticate(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params[0];

        if (!key) {
          return res.status(400).json({ error: "File key is required" });
        }

        const exists = await storageService.exists(key);
        if (!exists) {
          return res.status(404).json({ error: "File not found" });
        }

        const metadata = await storageService.getMetadata(key);

        res.status(200).json(metadata);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
