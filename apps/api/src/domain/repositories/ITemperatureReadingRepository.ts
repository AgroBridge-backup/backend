/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Repository Interface for TemperatureReading
 */

import {
  TemperatureReading,
  CreateTemperatureReadingInput,
} from "../entities/TemperatureReading.js";

export interface ITemperatureReadingRepository {
  /**
   * Find a temperature reading by ID
   */
  findById(id: string): Promise<TemperatureReading | null>;

  /**
   * Find all readings for a batch
   */
  findByBatchId(batchId: string): Promise<TemperatureReading[]>;

  /**
   * Find readings for a batch with pagination (efficient for large datasets)
   */
  findByBatchIdPaginated(
    batchId: string,
    options?: { limit?: number; offset?: number; orderBy?: "asc" | "desc" },
  ): Promise<TemperatureReading[]>;

  /**
   * Find readings for a batch within a time range
   */
  findByBatchIdAndTimeRange(
    batchId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<TemperatureReading[]>;

  /**
   * Find out-of-range readings for a batch
   */
  findOutOfRangeByBatchId(batchId: string): Promise<TemperatureReading[]>;

  /**
   * Find readings by sensor ID
   */
  findBySensorId(sensorId: string): Promise<TemperatureReading[]>;

  /**
   * Get the latest reading for a batch
   */
  findLatestByBatchId(batchId: string): Promise<TemperatureReading | null>;

  /**
   * Create a new temperature reading
   */
  create(input: CreateTemperatureReadingInput): Promise<TemperatureReading>;

  /**
   * Create multiple readings (batch insert)
   */
  createMany(inputs: CreateTemperatureReadingInput[]): Promise<number>;

  /**
   * Count readings for a batch
   */
  countByBatchId(batchId: string): Promise<number>;

  /**
   * Count out-of-range readings for a batch
   */
  countOutOfRangeByBatchId(batchId: string): Promise<number>;

  /**
   * Get min/max/avg temperature for a batch
   */
  getStatsByBatchId(batchId: string): Promise<{
    min: number | null;
    max: number | null;
    avg: number | null;
  }>;

  /**
   * Delete readings older than a date (for data retention)
   */
  deleteOlderThan(date: Date): Promise<number>;
}
