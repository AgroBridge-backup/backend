/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Prisma Repository Implementation for TemperatureReading
 */

import {
  PrismaClient,
  TemperatureSource as PrismaTemperatureSource,
} from "@prisma/client";
import { ITemperatureReadingRepository } from "../../../../domain/repositories/ITemperatureReadingRepository.js";
import {
  TemperatureReading,
  TemperatureSource,
  CreateTemperatureReadingInput,
  isTemperatureInRange,
} from "../../../../domain/entities/TemperatureReading.js";

export class PrismaTemperatureReadingRepository
  implements ITemperatureReadingRepository
{
  constructor(private prisma: PrismaClient) {}

  private mapToDomain(reading: any): TemperatureReading {
    return {
      id: reading.id,
      batchId: reading.batchId,
      value: Number(reading.value),
      humidity: reading.humidity ? Number(reading.humidity) : null,
      source: reading.source as TemperatureSource,
      minThreshold: Number(reading.minThreshold),
      maxThreshold: Number(reading.maxThreshold),
      isOutOfRange: reading.isOutOfRange,
      sensorId: reading.sensorId,
      deviceId: reading.deviceId,
      latitude: reading.latitude ? Number(reading.latitude) : null,
      longitude: reading.longitude ? Number(reading.longitude) : null,
      recordedBy: reading.recordedBy,
      timestamp: reading.timestamp,
    };
  }

  async findById(id: string): Promise<TemperatureReading | null> {
    const reading = await this.prisma.temperatureReading.findUnique({
      where: { id },
    });
    return reading ? this.mapToDomain(reading) : null;
  }

  async findByBatchId(batchId: string): Promise<TemperatureReading[]> {
    const readings = await this.prisma.temperatureReading.findMany({
      where: { batchId },
      orderBy: { timestamp: "desc" },
    });
    return readings.map(this.mapToDomain);
  }

  async findByBatchIdPaginated(
    batchId: string,
    options?: { limit?: number; offset?: number; orderBy?: "asc" | "desc" },
  ): Promise<TemperatureReading[]> {
    const readings = await this.prisma.temperatureReading.findMany({
      where: { batchId },
      orderBy: { timestamp: options?.orderBy ?? "desc" },
      take: options?.limit,
      skip: options?.offset,
    });
    return readings.map(this.mapToDomain);
  }

  async findByBatchIdAndTimeRange(
    batchId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<TemperatureReading[]> {
    const readings = await this.prisma.temperatureReading.findMany({
      where: {
        batchId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: "asc" },
    });
    return readings.map(this.mapToDomain);
  }

  async findOutOfRangeByBatchId(
    batchId: string,
  ): Promise<TemperatureReading[]> {
    const readings = await this.prisma.temperatureReading.findMany({
      where: {
        batchId,
        isOutOfRange: true,
      },
      orderBy: { timestamp: "desc" },
    });
    return readings.map(this.mapToDomain);
  }

  async findBySensorId(sensorId: string): Promise<TemperatureReading[]> {
    const readings = await this.prisma.temperatureReading.findMany({
      where: { sensorId },
      orderBy: { timestamp: "desc" },
    });
    return readings.map(this.mapToDomain);
  }

  async findLatestByBatchId(
    batchId: string,
  ): Promise<TemperatureReading | null> {
    const reading = await this.prisma.temperatureReading.findFirst({
      where: { batchId },
      orderBy: { timestamp: "desc" },
    });
    return reading ? this.mapToDomain(reading) : null;
  }

  async create(
    input: CreateTemperatureReadingInput,
  ): Promise<TemperatureReading> {
    const minThreshold = input.minThreshold ?? 0;
    const maxThreshold = input.maxThreshold ?? 8;
    const isOutOfRange = !isTemperatureInRange(
      input.value,
      minThreshold,
      maxThreshold,
    );

    const reading = await this.prisma.temperatureReading.create({
      data: {
        batchId: input.batchId,
        value: input.value,
        humidity: input.humidity,
        source: input.source as PrismaTemperatureSource,
        minThreshold,
        maxThreshold,
        isOutOfRange,
        sensorId: input.sensorId,
        deviceId: input.deviceId,
        latitude: input.latitude,
        longitude: input.longitude,
        recordedBy: input.recordedBy,
      },
    });

    return this.mapToDomain(reading);
  }

  async createMany(inputs: CreateTemperatureReadingInput[]): Promise<number> {
    const data = inputs.map((input) => {
      const minThreshold = input.minThreshold ?? 0;
      const maxThreshold = input.maxThreshold ?? 8;
      return {
        batchId: input.batchId,
        value: input.value,
        humidity: input.humidity,
        source: input.source as PrismaTemperatureSource,
        minThreshold,
        maxThreshold,
        isOutOfRange: !isTemperatureInRange(
          input.value,
          minThreshold,
          maxThreshold,
        ),
        sensorId: input.sensorId,
        deviceId: input.deviceId,
        latitude: input.latitude,
        longitude: input.longitude,
        recordedBy: input.recordedBy,
      };
    });

    const result = await this.prisma.temperatureReading.createMany({ data });
    return result.count;
  }

  async countByBatchId(batchId: string): Promise<number> {
    return this.prisma.temperatureReading.count({
      where: { batchId },
    });
  }

  async countOutOfRangeByBatchId(batchId: string): Promise<number> {
    return this.prisma.temperatureReading.count({
      where: { batchId, isOutOfRange: true },
    });
  }

  async getStatsByBatchId(batchId: string): Promise<{
    min: number | null;
    max: number | null;
    avg: number | null;
  }> {
    const result = await this.prisma.temperatureReading.aggregate({
      where: { batchId },
      _min: { value: true },
      _max: { value: true },
      _avg: { value: true },
    });

    return {
      min: result._min.value ? Number(result._min.value) : null,
      max: result._max.value ? Number(result._max.value) : null,
      avg: result._avg.value ? Number(result._avg.value) : null,
    };
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.prisma.temperatureReading.deleteMany({
      where: {
        timestamp: { lt: date },
      },
    });
    return result.count;
  }
}
