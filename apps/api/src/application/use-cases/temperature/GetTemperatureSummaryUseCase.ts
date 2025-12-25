/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Use Case: Get Temperature Summary
 */

import { PrismaClient } from '@prisma/client';
import { TemperatureMonitoringService } from '../../../domain/services/TemperatureMonitoringService.js';
import { TemperatureSummary } from '../../../domain/entities/TemperatureReading.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface GetTemperatureSummaryDTO {
  batchId: string;
}

export class GetTemperatureSummaryUseCase {
  constructor(
    private prisma: PrismaClient,
    private temperatureService: TemperatureMonitoringService
  ) {}

  async execute(input: GetTemperatureSummaryDTO): Promise<TemperatureSummary | null> {
    // Validate batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: input.batchId },
    });

    if (!batch) {
      throw new AppError('Batch not found', 404);
    }

    return this.temperatureService.getTemperatureSummary(input.batchId);
  }
}
