/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * Domain Service for Satellite Imagery Management
 *
 * @deprecated POST-MVP: Satellite imagery features not required for organic certification MVP.
 * This service will be reactivated after beta launch.
 */

import { PrismaClient } from '@prisma/client';
import { IFieldRepository, IFieldImageryRepository } from '../repositories/IFieldImageryRepository.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

export interface CreateFieldResult {
  field: any;
  computedArea: number;
}

export interface TimeLapseResult {
  timeLapse: any;
  generatedAt: Date;
}

/**
 * @deprecated POST-MVP - Stub service implementation
 */
export class SatelliteImageryService {
  constructor(
    private prisma: PrismaClient,
    private fieldRepository?: IFieldRepository,
    private imageryRepository?: IFieldImageryRepository
  ) {
    logger.info('[SatelliteImageryService] Stub service initialized - Satellite features disabled for MVP');
  }

  private throwMvpError(): never {
    throw new AppError(
      'Satellite imagery features not available in MVP. This feature will be available after beta launch.',
      501
    );
  }

  async createField(input: any): Promise<CreateFieldResult> {
    this.throwMvpError();
  }

  async getField(fieldId: string): Promise<any> {
    this.throwMvpError();
  }

  async getFieldsByProducer(producerId: string): Promise<any[]> {
    this.throwMvpError();
  }

  async updateField(fieldId: string, updates: any): Promise<any> {
    this.throwMvpError();
  }

  async deleteField(fieldId: string): Promise<void> {
    this.throwMvpError();
  }

  async fetchImagery(input: any): Promise<any> {
    this.throwMvpError();
  }

  async getTimeLapse(fieldId: string, options: any): Promise<TimeLapseResult> {
    this.throwMvpError();
  }

  async getHealthAnalysis(fieldId: string): Promise<any> {
    this.throwMvpError();
  }

  async detectAnomalies(fieldId: string): Promise<any[]> {
    this.throwMvpError();
  }
}
