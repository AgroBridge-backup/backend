/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Use Case: Get Temperature Readings
 */

import { PrismaClient } from "@prisma/client";
import {
  TemperatureMonitoringService,
  TemperatureChartData,
} from "../../../domain/services/TemperatureMonitoringService.js";
import { TemperatureReading } from "../../../domain/entities/TemperatureReading.js";
import { AppError } from "../../../shared/errors/AppError.js";

export interface GetTemperatureReadingsDTO {
  batchId: string;
  limit?: number;
  startTime?: Date;
  endTime?: Date;
}

export interface GetTemperatureReadingsResult {
  readings: TemperatureReading[];
  chartData?: TemperatureChartData;
}

export class GetTemperatureReadingsUseCase {
  constructor(
    private prisma: PrismaClient,
    private temperatureService: TemperatureMonitoringService,
  ) {}

  async execute(
    input: GetTemperatureReadingsDTO,
  ): Promise<GetTemperatureReadingsResult> {
    // Validate batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: input.batchId },
    });

    if (!batch) {
      throw new AppError("Batch not found", 404);
    }

    let readings: TemperatureReading[];
    let chartData: TemperatureChartData | undefined;

    if (input.startTime && input.endTime) {
      // Get chart data for time range
      chartData = await this.temperatureService.getChartData(
        input.batchId,
        input.startTime,
        input.endTime,
      );
      readings = await this.temperatureService.getReadings(
        input.batchId,
        input.limit,
      );
    } else {
      readings = await this.temperatureService.getReadings(
        input.batchId,
        input.limit,
      );
    }

    return { readings, chartData };
  }
}
