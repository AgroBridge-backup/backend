/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Use Case: Record Temperature Reading
 */

import { TemperatureMonitoringService, RecordTemperatureResult } from '../../../domain/services/TemperatureMonitoringService.js';
import { TemperatureSource } from '../../../domain/entities/TemperatureReading.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface RecordTemperatureDTO {
  batchId: string;
  value: number;
  humidity?: number;
  source: TemperatureSource;
  sensorId?: string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
  recordedBy?: string;
}

export class RecordTemperatureUseCase {
  constructor(private temperatureService: TemperatureMonitoringService) {}

  async execute(input: RecordTemperatureDTO): Promise<RecordTemperatureResult> {
    // Validate temperature value (reasonable range)
    if (input.value < -50 || input.value > 60) {
      throw new AppError('Temperature value out of reasonable range (-50 to 60°C)', 400);
    }

    // Validate humidity if provided
    if (input.humidity !== undefined && (input.humidity < 0 || input.humidity > 100)) {
      throw new AppError('Humidity must be between 0 and 100%', 400);
    }

    // Validate coordinates if provided
    if (input.latitude !== undefined && (input.latitude < -90 || input.latitude > 90)) {
      throw new AppError('Invalid latitude', 400);
    }
    if (input.longitude !== undefined && (input.longitude < -180 || input.longitude > 180)) {
      throw new AppError('Invalid longitude', 400);
    }

    return this.temperatureService.recordTemperature(input);
  }
}
