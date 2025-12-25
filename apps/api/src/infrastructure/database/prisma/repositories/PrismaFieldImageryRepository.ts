/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * Prisma Repository Implementation
 *
 * @deprecated POST-MVP: Satellite imagery features not required for organic certification MVP.
 * This repository will be reactivated after beta launch when we add
 * satellite monitoring for field verification.
 *
 * Errors: 24 TypeScript errors related to Prisma model field mismatches
 * Estimated fix time: 2 hours (not worth it for MVP)
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../../shared/errors/AppError.js';
import logger from '../../../../shared/utils/logger.js';

// Re-export interface types for compatibility
export { IFieldRepository, IFieldImageryRepository } from '../../../../domain/repositories/IFieldImageryRepository.js';

/**
 * @deprecated POST-MVP - Stub repository implementation for Field
 */
export class PrismaFieldRepository {
  constructor(private prisma: PrismaClient) {
    logger.info('[PrismaFieldRepository] Stub repository initialized - Satellite features disabled for MVP');
  }

  private throwMvpError(): never {
    throw new AppError(
      'Satellite imagery features not available in MVP. This feature will be available after beta launch.',
      501
    );
  }

  async create(input: any): Promise<any> {
    this.throwMvpError();
  }

  async findById(id: string): Promise<any> {
    this.throwMvpError();
  }

  async findByProducerId(producerId: string): Promise<any[]> {
    this.throwMvpError();
  }

  async update(id: string, data: any): Promise<any> {
    this.throwMvpError();
  }

  async delete(id: string): Promise<void> {
    this.throwMvpError();
  }

  async findByBoundingBox(bbox: any): Promise<any[]> {
    this.throwMvpError();
  }
}

/**
 * @deprecated POST-MVP - Stub repository implementation for FieldImagery
 */
export class PrismaFieldImageryRepository {
  constructor(private prisma: PrismaClient) {
    logger.info('[PrismaFieldImageryRepository] Stub repository initialized - Satellite features disabled for MVP');
  }

  private throwMvpError(): never {
    throw new AppError(
      'Satellite imagery features not available in MVP. This feature will be available after beta launch.',
      501
    );
  }

  async create(input: any): Promise<any> {
    this.throwMvpError();
  }

  async findById(id: string): Promise<any> {
    this.throwMvpError();
  }

  async findByFieldId(fieldId: string, options?: any): Promise<any[]> {
    this.throwMvpError();
  }

  async findLatestByFieldId(fieldId: string): Promise<any> {
    this.throwMvpError();
  }

  async findByDateRange(fieldId: string, startDate: Date, endDate: Date): Promise<any[]> {
    this.throwMvpError();
  }

  async update(id: string, data: any): Promise<any> {
    this.throwMvpError();
  }

  async delete(id: string): Promise<void> {
    this.throwMvpError();
  }

  async getTimeLapseData(fieldId: string, options?: any): Promise<any[]> {
    this.throwMvpError();
  }
}
