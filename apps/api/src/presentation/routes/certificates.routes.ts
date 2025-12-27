/**
 * Traceability 2.0 - Blockchain Quality Certificates
 * API Routes for Certificate Issuance and Verification
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validator.middleware.js";
import {
  UserRole,
  CertificateGrade as PrismaCertificateGrade,
} from "@prisma/client";
import { CertificateGrade } from "../../domain/entities/QualityCertificate.js";
import { RateLimiterConfig } from "../../infrastructure/http/middleware/rate-limiter.middleware.js";
import { IssueCertificateUseCase } from "../../application/use-cases/certificates/IssueCertificateUseCase.js";
import { GetCertificateUseCase } from "../../application/use-cases/certificates/GetCertificateUseCase.js";
import { ListBatchCertificatesUseCase } from "../../application/use-cases/certificates/ListBatchCertificatesUseCase.js";
import { VerifyCertificateUseCase } from "../../application/use-cases/certificates/VerifyCertificateUseCase.js";
import { CheckCertificateEligibilityUseCase } from "../../application/use-cases/certificates/CheckCertificateEligibilityUseCase.js";
import {
  isValidCertificateGrade,
  VALID_CERTIFICATE_GRADES,
} from "../validation/certificate.schemas.js";

export interface CertificatesUseCases {
  issueCertificateUseCase: IssueCertificateUseCase;
  getCertificateUseCase: GetCertificateUseCase;
  listBatchCertificatesUseCase: ListBatchCertificatesUseCase;
  verifyCertificateUseCase: VerifyCertificateUseCase;
  checkCertificateEligibilityUseCase: CheckCertificateEligibilityUseCase;
}

export function createCertificatesRouter(
  useCases?: CertificatesUseCases,
): Router {
  const router = Router();

  // Guard: Return empty router if use cases not provided
  if (!useCases) {
    return router;
  }

  // Schema Definitions
  const issueCertificateSchema = z.object({
    body: z.object({
      grade: z.nativeEnum(PrismaCertificateGrade),
      certifyingBody: z.string().min(1).max(255),
      validityDays: z.number().int().min(1).max(3650).optional(), // Max 10 years
    }),
    params: z.object({
      id: z.string().uuid(),
    }),
  });

  const checkEligibilitySchema = z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
    query: z.object({
      grade: z.string().refine(isValidCertificateGrade, {
        message: `Invalid grade. Must be one of: ${VALID_CERTIFICATE_GRADES.join(", ")}`,
      }),
    }),
  });

  const certificateIdSchema = z.object({
    params: z.object({
      certificateId: z.string().uuid(),
    }),
  });

  const listCertificatesSchema = z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
    query: z.object({
      validOnly: z
        .string()
        .optional()
        .transform((val) => val === "true"),
    }),
  });

  /**
   * POST /api/v1/batches/:id/certificates
   * Issue a new quality certificate for a batch
   * Requires CERTIFIER or ADMIN role
   * Validates required stages are approved based on grade
   */
  router.post(
    "/batches/:id/certificates",
    authenticate([UserRole.CERTIFIER, UserRole.ADMIN]),
    RateLimiterConfig.creation(),
    validateRequest(issueCertificateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.issueCertificateUseCase.execute({
          batchId: req.params.id,
          grade: req.body.grade,
          certifyingBody: req.body.certifyingBody,
          validityDays: req.body.validityDays,
          issuedBy: req.user!.userId,
        });

        res.status(201).json({
          success: true,
          data: {
            certificate: result.certificate,
            hash: result.hash,
            blockchainTxId: result.blockchainTxId,
          },
          message: result.blockchainTxId
            ? "Certificate issued and stored on blockchain."
            : "Certificate issued. Blockchain storage pending.",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/batches/:id/certificates
   * List all certificates for a batch
   * Optional query param: validOnly=true to filter non-expired certificates
   */
  router.get(
    "/batches/:id/certificates",
    authenticate(),
    validateRequest(listCertificatesSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const certificates =
          await useCases.listBatchCertificatesUseCase.execute({
            batchId: req.params.id,
            validOnly: req.query.validOnly === "true",
          });

        res.status(200).json({
          success: true,
          data: {
            certificates,
            count: certificates.length,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/batches/:id/certificates/eligibility
   * Check if a batch can receive a certificate of a specific grade
   */
  router.get(
    "/batches/:id/certificates/eligibility",
    authenticate(),
    validateRequest(checkEligibilitySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Grade has already been validated by Zod schema
        const validatedGrade = req.query.grade as CertificateGrade;
        const result =
          await useCases.checkCertificateEligibilityUseCase.execute({
            batchId: req.params.id,
            grade: validatedGrade,
          });

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/certificates/:certificateId
   * Get certificate details by ID
   */
  router.get(
    "/certificates/:certificateId",
    authenticate(),
    validateRequest(certificateIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const certificate = await useCases.getCertificateUseCase.execute({
          certificateId: req.params.certificateId,
        });

        res.status(200).json({
          success: true,
          data: certificate,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/certificates/:certificateId/verify
   * Verify certificate authenticity and validity
   * Recomputes hash and checks against stored value
   * Public endpoint for external verification (rate limited to prevent abuse)
   */
  router.get(
    "/certificates/:certificateId/verify",
    RateLimiterConfig.api(), // Rate limit public endpoint to prevent DoS
    validateRequest(certificateIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await useCases.verifyCertificateUseCase.execute({
          certificateId: req.params.certificateId,
        });

        res.status(200).json({
          success: true,
          data: {
            isValid: result.isValid,
            isExpired: result.isExpired,
            message: result.message,
            certificate: result.certificate
              ? {
                  id: result.certificate.id,
                  batchId: result.certificate.batchId,
                  grade: result.certificate.grade,
                  certifyingBody: result.certificate.certifyingBody,
                  validFrom: result.certificate.validFrom,
                  validTo: result.certificate.validTo,
                  issuedAt: result.certificate.issuedAt,
                }
              : null,
            verification: {
              computedHash: result.computedHash,
              storedHash: result.storedHash,
              hashMatch: result.computedHash === result.storedHash,
            },
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
