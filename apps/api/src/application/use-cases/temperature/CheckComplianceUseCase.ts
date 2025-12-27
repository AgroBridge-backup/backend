/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Use Case: Check Cold Chain Compliance
 */

import { PrismaClient } from "@prisma/client";
import { TemperatureMonitoringService } from "../../../domain/services/TemperatureMonitoringService.js";
import {
  TemperatureReading,
  TemperatureSummary,
} from "../../../domain/entities/TemperatureReading.js";
import { AppError } from "../../../shared/errors/AppError.js";

export interface CheckComplianceDTO {
  batchId: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  summary: TemperatureSummary | null;
  violations: TemperatureReading[];
  rapidChanges: TemperatureReading[];
  complianceScore: number; // 0-100
  recommendations: string[];
}

export class CheckComplianceUseCase {
  constructor(
    private prisma: PrismaClient,
    private temperatureService: TemperatureMonitoringService,
  ) {}

  async execute(input: CheckComplianceDTO): Promise<ComplianceResult> {
    // Validate batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: input.batchId },
    });

    if (!batch) {
      throw new AppError("Batch not found", 404);
    }

    const result = await this.temperatureService.checkCompliance(input.batchId);

    // Calculate compliance score
    let complianceScore = 100;
    const recommendations: string[] = [];

    if (result.summary) {
      // Deduct points for out-of-range readings
      const outOfRangePercent = result.summary.outOfRangePercent;
      complianceScore -= outOfRangePercent;

      // Deduct points for rapid changes
      const rapidChangeCount = result.rapidChanges.length;
      complianceScore -= rapidChangeCount * 5;

      // Ensure score is within bounds
      complianceScore = Math.max(0, Math.min(100, complianceScore));

      // Generate recommendations
      if (outOfRangePercent > 0) {
        recommendations.push(
          `${outOfRangePercent}% of readings were out of range. Review cold chain equipment.`,
        );
      }

      if (rapidChangeCount > 0) {
        recommendations.push(
          `${rapidChangeCount} rapid temperature change(s) detected. Check for cold chain breaches.`,
        );
      }

      if (result.summary.maxValue - result.summary.minValue > 10) {
        recommendations.push(
          "High temperature variance detected. Consider improving insulation or cooling capacity.",
        );
      }

      if (complianceScore < 80) {
        recommendations.push(
          "Compliance score is below acceptable threshold. Immediate corrective action required.",
        );
      }
    } else {
      recommendations.push(
        "No temperature readings recorded. Start monitoring to ensure compliance.",
      );
    }

    return {
      isCompliant: result.isCompliant,
      summary: result.summary,
      violations: result.violations,
      rapidChanges: result.rapidChanges,
      complianceScore,
      recommendations,
    };
  }
}
