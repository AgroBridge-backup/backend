/**
 * @file Report Validators
 * @description Zod validation schemas for report endpoints
 *
 * @author AgroBridge Engineering Team
 */

import { z } from "zod";
import { ReportType, ReportFormat, ReportStatus } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Report type enum validation
 */
export const reportTypeSchema = z.nativeEnum(ReportType);

/**
 * Report format enum validation
 */
export const reportFormatSchema = z.nativeEnum(ReportFormat);

/**
 * Report status enum validation
 */
export const reportStatusSchema = z.nativeEnum(ReportStatus);

/**
 * Report filters schema
 */
export const reportFiltersSchema = z
  .object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    producerId: z.string().uuid().optional(),
    status: z.string().optional(),
    variety: z.string().optional(),
  })
  .optional();

/**
 * Create report request schema
 */
export const createReportSchema = z.object({
  body: z.object({
    type: reportTypeSchema,
    format: reportFormatSchema,
    name: z.string().min(1).max(255).optional(),
    filters: reportFiltersSchema,
  }),
});

/**
 * List reports query schema
 */
export const listReportsSchema = z.object({
  query: z.object({
    type: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        return val as ReportType;
      }),
    status: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        return val as ReportStatus;
      }),
    limit: z
      .string()
      .optional()
      .default("20")
      .transform((val) => parseInt(val, 10)),
    offset: z
      .string()
      .optional()
      .default("0")
      .transform((val) => parseInt(val, 10)),
  }),
});

/**
 * Get report by ID schema
 */
export const getReportSchema = z.object({
  params: z.object({
    reportId: z.string().uuid("Invalid report ID"),
  }),
});

/**
 * Delete report schema
 */
export const deleteReportSchema = z.object({
  params: z.object({
    reportId: z.string().uuid("Invalid report ID"),
  }),
});

/**
 * Download report schema
 */
export const downloadReportSchema = z.object({
  params: z.object({
    reportId: z.string().uuid("Invalid report ID"),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ListReportsInput = z.infer<typeof listReportsSchema>;
export type GetReportInput = z.infer<typeof getReportSchema>;
export type DeleteReportInput = z.infer<typeof deleteReportSchema>;
export type DownloadReportInput = z.infer<typeof downloadReportSchema>;
