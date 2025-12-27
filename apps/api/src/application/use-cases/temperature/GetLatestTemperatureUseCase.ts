/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Use Case: Get Latest Temperature Reading
 */

import { PrismaClient } from "@prisma/client";
import { TemperatureMonitoringService } from "../../../domain/services/TemperatureMonitoringService.js";
import { TemperatureReading } from "../../../domain/entities/TemperatureReading.js";
import { AppError } from "../../../shared/errors/AppError.js";

export interface GetLatestTemperatureDTO {
  batchId: string;
}

export class GetLatestTemperatureUseCase {
  constructor(
    private prisma: PrismaClient,
    private temperatureService: TemperatureMonitoringService,
  ) {}

  async execute(
    input: GetLatestTemperatureDTO,
  ): Promise<TemperatureReading | null> {
    // Validate batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: input.batchId },
    });

    if (!batch) {
      throw new AppError("Batch not found", 404);
    }

    return this.temperatureService.getLatestReading(input.batchId);
  }
}
