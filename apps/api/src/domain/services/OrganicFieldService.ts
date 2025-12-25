/**
 * OrganicField Domain Service
 * Business logic for organic field management
 * Handles field registration, status transitions, and boundary verification
 */

import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../shared/errors/AppError.js';
import { IOrganicFieldRepository } from '../repositories/IOrganicFieldRepository.js';
import {
  OrganicField,
  OrganicFieldFilter,
  OrganicFieldStatus,
  OrganicFieldWithStats,
  CreateOrganicFieldInput,
  UpdateOrganicFieldInput,
  ORGANIC_TRANSITION_MONTHS,
  SUPPORTED_CROP_TYPES,
} from '../entities/OrganicField.js';
import logger from '../../shared/utils/logger.js';

export interface RegisterFieldResult {
  field: OrganicField;
  transitionEndDate?: Date;
}

export class OrganicFieldService {
  constructor(private repository: IOrganicFieldRepository) {}

  /**
   * Register a new organic field
   */
  async registerField(input: CreateOrganicFieldInput): Promise<RegisterFieldResult> {
    // Validate crop type
    if (!SUPPORTED_CROP_TYPES.includes(input.cropType as any)) {
      throw new AppError(`Unsupported crop type: ${input.cropType}. Supported: ${SUPPORTED_CROP_TYPES.join(', ')}`, 400);
    }

    // Validate GeoJSON boundary
    if (!this.isValidGeoJson(input.boundaryGeoJson)) {
      throw new AppError('Invalid GeoJSON boundary format', 400);
    }

    // Validate area
    if (input.areaHectares <= 0) {
      throw new AppError('Area must be greater than 0 hectares', 400);
    }

    // Calculate transition end date if organicSince is provided
    let transitionEndDate: Date | undefined;
    let certificationStatus = OrganicFieldStatus.PENDING_VERIFICATION;

    if (input.organicSince) {
      const organicSinceDate = new Date(input.organicSince);
      const monthsOrganic = Math.floor(
        (Date.now() - organicSinceDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      if (monthsOrganic >= ORGANIC_TRANSITION_MONTHS) {
        // Already past transition period - can be certified after inspection
        certificationStatus = OrganicFieldStatus.PENDING_VERIFICATION;
      } else {
        // Still in transition
        certificationStatus = OrganicFieldStatus.TRANSITIONAL;
        transitionEndDate = new Date(organicSinceDate);
        transitionEndDate.setMonth(transitionEndDate.getMonth() + ORGANIC_TRANSITION_MONTHS);
      }
    }

    const field = await this.repository.create({
      id: uuidv4(),
      producerId: input.producerId,
      baseFieldId: input.baseFieldId,
      name: input.name,
      localIdentifier: input.localIdentifier,
      cropType: input.cropType,
      variety: input.variety,
      areaHectares: input.areaHectares,
      boundaryGeoJson: input.boundaryGeoJson,
      centerLat: input.centerLat,
      centerLng: input.centerLng,
      altitude: input.altitude,
      organicSince: input.organicSince,
      lastConventional: input.lastConventional,
      transitionEndDate,
      certificationStatus,
      certifiedStandards: input.certifiedStandards || [],
      waterSources: input.waterSources || [],
      irrigationType: input.irrigationType,
      soilType: input.soilType,
      lastSoilTestDate: input.lastSoilTestDate,
    });

    logger.info(`Organic field registered: ${field.id} for producer ${field.producerId}`);

    return { field, transitionEndDate };
  }

  /**
   * Get field by ID with stats
   */
  async getFieldWithStats(id: string): Promise<OrganicFieldWithStats> {
    const field = await this.repository.findByIdWithStats(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }
    return field;
  }

  /**
   * Get field by ID
   */
  async getField(id: string): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }
    return field;
  }

  /**
   * List fields for a producer
   */
  async listProducerFields(
    producerId: string,
    filter?: Omit<OrganicFieldFilter, 'producerId'>
  ): Promise<{ fields: OrganicField[]; total: number }> {
    return this.repository.listByProducer(producerId, filter);
  }

  /**
   * Update field details
   */
  async updateField(id: string, input: UpdateOrganicFieldInput): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    // Validate GeoJSON if being updated
    if (input.boundaryGeoJson && !this.isValidGeoJson(input.boundaryGeoJson)) {
      throw new AppError('Invalid GeoJSON boundary format', 400);
    }

    // Validate area if being updated
    if (input.areaHectares !== undefined && input.areaHectares <= 0) {
      throw new AppError('Area must be greater than 0 hectares', 400);
    }

    logger.info(`Updating organic field: ${id}`);

    return this.repository.update(id, input);
  }

  /**
   * Transition field to certified status
   */
  async certifyField(id: string, standards: string[]): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    // Field must be either transitional (past end date) or pending verification
    if (field.certificationStatus === OrganicFieldStatus.CERTIFIED) {
      throw new AppError('Field is already certified', 400);
    }

    if (field.certificationStatus === OrganicFieldStatus.TRANSITIONAL) {
      if (field.transitionEndDate && new Date() < field.transitionEndDate) {
        throw new AppError('Field is still in transition period', 400);
      }
    }

    // Update status and add standards
    let updatedField = await this.repository.updateCertificationStatus(
      id,
      OrganicFieldStatus.CERTIFIED
    );

    for (const standard of standards) {
      updatedField = await this.repository.addCertifiedStandard(id, standard);
    }

    logger.info(`Organic field certified: ${id} with standards ${standards.join(', ')}`);

    return updatedField;
  }

  /**
   * Suspend field certification
   */
  async suspendCertification(id: string, reason: string): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    if (field.certificationStatus !== OrganicFieldStatus.CERTIFIED) {
      throw new AppError('Only certified fields can be suspended', 400);
    }

    logger.warn(`Organic field certification suspended: ${id}, reason: ${reason}`);

    return this.repository.updateCertificationStatus(id, OrganicFieldStatus.SUSPENDED);
  }

  /**
   * Revoke field certification
   */
  async revokeCertification(id: string, reason: string): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    logger.warn(`Organic field certification revoked: ${id}, reason: ${reason}`);

    return this.repository.updateCertificationStatus(id, OrganicFieldStatus.REVOKED);
  }

  /**
   * Reinstate suspended certification
   */
  async reinstateCertification(id: string): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    if (field.certificationStatus !== OrganicFieldStatus.SUSPENDED) {
      throw new AppError('Only suspended fields can be reinstated', 400);
    }

    logger.info(`Organic field certification reinstated: ${id}`);

    return this.repository.updateCertificationStatus(id, OrganicFieldStatus.CERTIFIED);
  }

  /**
   * Verify GPS location is within field boundary
   */
  async verifyLocationWithinField(
    fieldId: string,
    lat: number,
    lng: number
  ): Promise<{ isWithin: boolean; distanceFromCenter?: number }> {
    const field = await this.repository.findById(fieldId);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    const isWithin = await this.repository.isPointWithinBoundary(fieldId, lat, lng);

    // Calculate distance from center
    const distanceFromCenter = this.haversineDistance(
      lat,
      lng,
      field.centerLat,
      field.centerLng
    );

    return { isWithin, distanceFromCenter };
  }

  /**
   * Deactivate a field
   */
  async deactivateField(id: string): Promise<OrganicField> {
    const field = await this.repository.findById(id);
    if (!field) {
      throw new AppError('Organic field not found', 404);
    }

    logger.info(`Organic field deactivated: ${id}`);

    return this.repository.deactivate(id);
  }

  /**
   * Get producer statistics
   */
  async getProducerFieldStats(producerId: string): Promise<{
    totalFields: number;
    totalHectares: number;
    byStatus: Record<OrganicFieldStatus, number>;
    byCropType: Record<string, number>;
  }> {
    const [totalFields, totalHectares, allFields] = await Promise.all([
      this.repository.countByProducer(producerId),
      this.repository.getTotalHectaresByProducer(producerId),
      this.repository.listByProducer(producerId, { isActive: true, limit: 1000 }),
    ]);

    const byStatus: Record<OrganicFieldStatus, number> = {
      [OrganicFieldStatus.PENDING_VERIFICATION]: 0,
      [OrganicFieldStatus.TRANSITIONAL]: 0,
      [OrganicFieldStatus.CERTIFIED]: 0,
      [OrganicFieldStatus.SUSPENDED]: 0,
      [OrganicFieldStatus.REVOKED]: 0,
    };

    const byCropType: Record<string, number> = {};

    for (const field of allFields.fields) {
      byStatus[field.certificationStatus]++;
      byCropType[field.cropType] = (byCropType[field.cropType] || 0) + 1;
    }

    return { totalFields, totalHectares, byStatus, byCropType };
  }

  /**
   * Get fields ready for certification review
   */
  async getFieldsReadyForCertification(): Promise<OrganicField[]> {
    return this.repository.getFieldsReadyForCertification();
  }

  /**
   * Validate GeoJSON format
   */
  private isValidGeoJson(geoJson: string): boolean {
    try {
      const parsed = JSON.parse(geoJson);
      return (
        parsed.type === 'Polygon' &&
        Array.isArray(parsed.coordinates) &&
        parsed.coordinates.length > 0 &&
        Array.isArray(parsed.coordinates[0]) &&
        parsed.coordinates[0].length >= 4 // Minimum 4 points for a closed polygon
      );
    } catch {
      return false;
    }
  }

  /**
   * Calculate Haversine distance between two points
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
