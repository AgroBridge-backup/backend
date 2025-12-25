/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * Repository Interface for Field and Imagery
 */

import {
  Field,
  FieldImagery,
  FieldStatus,
  ImagerySource,
  ImageryType,
  CreateFieldInput,
  GeoJsonPolygon,
} from '../entities/FieldImagery.js';

export interface IFieldRepository {
  /**
   * Find a field by ID
   */
  findById(id: string): Promise<Field | null>;

  /**
   * Find fields by producer ID
   */
  findByProducerId(producerId: string): Promise<Field[]>;

  /**
   * Find fields by status
   */
  findByStatus(status: FieldStatus): Promise<Field[]>;

  /**
   * Find fields within a bounding box
   */
  findInBoundingBox(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number
  ): Promise<Field[]>;

  /**
   * Create a new field
   */
  create(input: CreateFieldInput): Promise<Field>;

  /**
   * Update a field
   */
  update(id: string, data: Partial<Field>): Promise<Field>;

  /**
   * Delete a field
   */
  delete(id: string): Promise<void>;

  /**
   * Count fields by producer
   */
  countByProducerId(producerId: string): Promise<number>;

  /**
   * Get total area by producer
   */
  getTotalAreaByProducerId(producerId: string): Promise<number>;
}

export interface IFieldImageryRepository {
  /**
   * Find imagery by ID
   */
  findById(id: string): Promise<FieldImagery | null>;

  /**
   * Find imagery for a field
   */
  findByFieldId(fieldId: string): Promise<FieldImagery[]>;

  /**
   * Find imagery for a field within date range
   */
  findByFieldIdAndDateRange(
    fieldId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FieldImagery[]>;

  /**
   * Find imagery by source and type
   */
  findByFieldIdSourceAndType(
    fieldId: string,
    source: ImagerySource,
    imageType: ImageryType
  ): Promise<FieldImagery[]>;

  /**
   * Find latest imagery for a field
   */
  findLatestByFieldId(fieldId: string): Promise<FieldImagery | null>;

  /**
   * Find imagery with low cloud cover
   */
  findByFieldIdWithMaxCloudCover(
    fieldId: string,
    maxCloudCover: number
  ): Promise<FieldImagery[]>;

  /**
   * Create new imagery record
   */
  create(data: Omit<FieldImagery, 'id' | 'createdAt'>): Promise<FieldImagery>;

  /**
   * Create multiple imagery records
   */
  createMany(data: Omit<FieldImagery, 'id' | 'createdAt'>[]): Promise<number>;

  /**
   * Update imagery record
   */
  update(id: string, data: Partial<FieldImagery>): Promise<FieldImagery>;

  /**
   * Delete imagery older than date
   */
  deleteOlderThan(date: Date): Promise<number>;

  /**
   * Get NDVI time series for a field
   */
  getNdviTimeSeries(
    fieldId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: Date; ndviValue: number | null }[]>;

  /**
   * Get imagery statistics for a field
   */
  getStatsByFieldId(fieldId: string): Promise<{
    totalImages: number;
    latestCapture: Date | null;
    averageNdvi: number | null;
    averageHealthScore: number | null;
    anomalyCount: number;
  }>;
}
