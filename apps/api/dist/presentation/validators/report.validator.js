import { z } from 'zod';
import { ReportType, ReportFormat, ReportStatus } from '@prisma/client';
export const reportTypeSchema = z.nativeEnum(ReportType);
export const reportFormatSchema = z.nativeEnum(ReportFormat);
export const reportStatusSchema = z.nativeEnum(ReportStatus);
export const reportFiltersSchema = z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    producerId: z.string().uuid().optional(),
    status: z.string().optional(),
    variety: z.string().optional(),
}).optional();
export const createReportSchema = z.object({
    body: z.object({
        type: reportTypeSchema,
        format: reportFormatSchema,
        name: z.string().min(1).max(255).optional(),
        filters: reportFiltersSchema,
    }),
});
export const listReportsSchema = z.object({
    query: z.object({
        type: z.string().optional().transform((val) => {
            if (!val)
                return undefined;
            return val;
        }),
        status: z.string().optional().transform((val) => {
            if (!val)
                return undefined;
            return val;
        }),
        limit: z.string().optional().default('20').transform((val) => parseInt(val, 10)),
        offset: z.string().optional().default('0').transform((val) => parseInt(val, 10)),
    }),
});
export const getReportSchema = z.object({
    params: z.object({
        reportId: z.string().uuid('Invalid report ID'),
    }),
});
export const deleteReportSchema = z.object({
    params: z.object({
        reportId: z.string().uuid('Invalid report ID'),
    }),
});
export const downloadReportSchema = z.object({
    params: z.object({
        reportId: z.string().uuid('Invalid report ID'),
    }),
});
