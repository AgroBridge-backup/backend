/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Domain Service for Temperature Monitoring
 */

import { PrismaClient } from "@prisma/client";
import { ITemperatureReadingRepository } from "../repositories/ITemperatureReadingRepository.js";
import {
  TemperatureReading,
  TemperatureSource,
  TemperatureSummary,
  TemperatureAlert,
  CreateTemperatureReadingInput,
  calculateTemperatureStats,
  detectRapidChange,
  getAlertSeverity,
  DEFAULT_THRESHOLDS,
} from "../entities/TemperatureReading.js";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";

export interface RecordTemperatureInput {
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

export interface RecordTemperatureResult {
  reading: TemperatureReading;
  isOutOfRange: boolean;
  alert: TemperatureAlert | null;
}

export interface TemperatureChartData {
  labels: string[];
  values: number[];
  thresholdMin: number;
  thresholdMax: number;
  outOfRangeIndices: number[];
}

export class TemperatureMonitoringService {
  constructor(
    private prisma: PrismaClient,
    private readingRepository: ITemperatureReadingRepository,
  ) {}

  /**
   * Record a new temperature reading
   */
  async recordTemperature(
    input: RecordTemperatureInput,
  ): Promise<RecordTemperatureResult> {
    // Validate batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: input.batchId },
    });

    if (!batch) {
      throw new AppError("Batch not found", 404);
    }

    // Get thresholds based on crop type
    const thresholds = this.getThresholdsForCrop(batch.variety || "DEFAULT");

    const readingInput: CreateTemperatureReadingInput = {
      batchId: input.batchId,
      value: input.value,
      humidity: input.humidity,
      source: input.source,
      minThreshold: thresholds.min,
      maxThreshold: thresholds.max,
      sensorId: input.sensorId,
      deviceId: input.deviceId,
      latitude: input.latitude,
      longitude: input.longitude,
      recordedBy: input.recordedBy,
    };

    const reading = await this.readingRepository.create(readingInput);

    // Check for alerts
    let alert: TemperatureAlert | null = null;
    if (reading.isOutOfRange) {
      const severity = getAlertSeverity(
        reading.value,
        thresholds.min,
        thresholds.max,
      );
      if (severity) {
        alert = {
          id: `alert-${reading.id}`,
          readingId: reading.id,
          batchId: input.batchId,
          type: reading.value < thresholds.min ? "LOW_TEMP" : "HIGH_TEMP",
          severity,
          message:
            reading.value < thresholds.min
              ? `Temperature ${reading.value}°C is below minimum ${thresholds.min}°C`
              : `Temperature ${reading.value}°C exceeds maximum ${thresholds.max}°C`,
          value: reading.value,
          threshold:
            reading.value < thresholds.min ? thresholds.min : thresholds.max,
          timestamp: reading.timestamp,
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
        };

        logger.warn("Temperature alert generated", {
          batchId: input.batchId,
          value: reading.value,
          type: alert.type,
          severity: alert.severity,
        });
      }
    }

    // Check for rapid temperature changes
    const recentReadings =
      await this.readingRepository.findByBatchIdAndTimeRange(
        input.batchId,
        new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
        new Date(),
      );

    const rapidChanges = detectRapidChange(recentReadings);
    if (
      rapidChanges.length > 0 &&
      rapidChanges[rapidChanges.length - 1].id === reading.id
    ) {
      if (!alert) {
        alert = {
          id: `alert-rapid-${reading.id}`,
          readingId: reading.id,
          batchId: input.batchId,
          type: "RAPID_CHANGE",
          severity: "WARNING",
          message:
            "Rapid temperature change detected - possible cold chain breach",
          value: reading.value,
          threshold: 3, // °C per hour threshold
          timestamp: reading.timestamp,
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
        };
      }
    }

    logger.info("Temperature reading recorded", {
      readingId: reading.id,
      batchId: input.batchId,
      value: reading.value,
      isOutOfRange: reading.isOutOfRange,
      source: input.source,
    });

    return {
      reading,
      isOutOfRange: reading.isOutOfRange,
      alert,
    };
  }

  /**
   * Record multiple temperature readings (batch insert from IoT sensors)
   */
  async recordBatchTemperatures(
    inputs: RecordTemperatureInput[],
  ): Promise<{ count: number; outOfRangeCount: number }> {
    if (inputs.length === 0) {
      return { count: 0, outOfRangeCount: 0 };
    }

    // Get batch info for thresholds
    const batchIds = [...new Set(inputs.map((i) => i.batchId))];
    const batches = await this.prisma.batch.findMany({
      where: { id: { in: batchIds } },
    });

    const batchThresholds = new Map<string, { min: number; max: number }>();
    batches.forEach((batch) => {
      batchThresholds.set(
        batch.id,
        this.getThresholdsForCrop(batch.variety || "DEFAULT"),
      );
    });

    const readingInputs: CreateTemperatureReadingInput[] = inputs.map(
      (input) => {
        const thresholds =
          batchThresholds.get(input.batchId) || DEFAULT_THRESHOLDS.DEFAULT;
        return {
          batchId: input.batchId,
          value: input.value,
          humidity: input.humidity,
          source: input.source,
          minThreshold: thresholds.min,
          maxThreshold: thresholds.max,
          sensorId: input.sensorId,
          deviceId: input.deviceId,
          latitude: input.latitude,
          longitude: input.longitude,
          recordedBy: input.recordedBy,
        };
      },
    );

    const count = await this.readingRepository.createMany(readingInputs);

    // Count out of range (simple calculation)
    const outOfRangeCount = inputs.filter((input) => {
      const thresholds =
        batchThresholds.get(input.batchId) || DEFAULT_THRESHOLDS.DEFAULT;
      return input.value < thresholds.min || input.value > thresholds.max;
    }).length;

    logger.info("Batch temperature readings recorded", {
      count,
      outOfRangeCount,
      batchIds,
    });

    return { count, outOfRangeCount };
  }

  /**
   * Get temperature summary for a batch
   */
  async getTemperatureSummary(
    batchId: string,
  ): Promise<TemperatureSummary | null> {
    const readings = await this.readingRepository.findByBatchId(batchId);
    return calculateTemperatureStats(readings);
  }

  /**
   * Get temperature readings for a batch
   * Uses database-level pagination for efficiency
   */
  async getReadings(
    batchId: string,
    limit?: number,
  ): Promise<TemperatureReading[]> {
    if (limit) {
      return this.readingRepository.findByBatchIdPaginated(batchId, { limit });
    }
    return this.readingRepository.findByBatchId(batchId);
  }

  /**
   * Get the latest temperature reading for a batch
   */
  async getLatestReading(batchId: string): Promise<TemperatureReading | null> {
    return this.readingRepository.findLatestByBatchId(batchId);
  }

  /**
   * Get temperature readings for charting
   */
  async getChartData(
    batchId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<TemperatureChartData> {
    const readings = await this.readingRepository.findByBatchIdAndTimeRange(
      batchId,
      startTime,
      endTime,
    );

    if (readings.length === 0) {
      return {
        labels: [],
        values: [],
        thresholdMin: 0,
        thresholdMax: 8,
        outOfRangeIndices: [],
      };
    }

    const labels = readings.map((r) => r.timestamp.toISOString());
    const values = readings.map((r) => r.value);
    const outOfRangeIndices = readings
      .map((r, i) => (r.isOutOfRange ? i : -1))
      .filter((i) => i >= 0);

    return {
      labels,
      values,
      thresholdMin: readings[0].minThreshold,
      thresholdMax: readings[0].maxThreshold,
      outOfRangeIndices,
    };
  }

  /**
   * Get out-of-range readings for a batch
   */
  async getOutOfRangeReadings(batchId: string): Promise<TemperatureReading[]> {
    return this.readingRepository.findOutOfRangeByBatchId(batchId);
  }

  /**
   * Check cold chain compliance for a batch
   */
  async checkCompliance(batchId: string): Promise<{
    isCompliant: boolean;
    summary: TemperatureSummary | null;
    violations: TemperatureReading[];
    rapidChanges: TemperatureReading[];
  }> {
    const readings = await this.readingRepository.findByBatchId(batchId);

    if (readings.length === 0) {
      return {
        isCompliant: true,
        summary: null,
        violations: [],
        rapidChanges: [],
      };
    }

    const summary = calculateTemperatureStats(readings);
    const violations = readings.filter((r) => r.isOutOfRange);
    const rapidChanges = detectRapidChange(readings);

    return {
      isCompliant: violations.length === 0 && rapidChanges.length === 0,
      summary,
      violations,
      rapidChanges,
    };
  }

  /**
   * Get thresholds for a crop type
   */
  private getThresholdsForCrop(variety: string): { min: number; max: number } {
    const upperVariety = variety.toUpperCase();
    return DEFAULT_THRESHOLDS[upperVariety] || DEFAULT_THRESHOLDS.DEFAULT;
  }
}
