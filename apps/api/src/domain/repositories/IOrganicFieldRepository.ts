/**
 * OrganicField Repository Interface
 * Defines the contract for organic field data access
 */

import {
  OrganicField,
  OrganicFieldFilter,
  OrganicFieldStatus,
  OrganicFieldWithStats,
} from '../entities/OrganicField.js';

export interface CreateOrganicFieldData {
  id: string;
  producerId: string;
  baseFieldId?: string;
  name: string;
  localIdentifier?: string;
  cropType: string;
  variety?: string;
  areaHectares: number;
  boundaryGeoJson: string;
  centerLat: number;
  centerLng: number;
  altitude?: number;
  organicSince?: Date;
  lastConventional?: Date;
  transitionEndDate?: Date;
  certificationStatus: OrganicFieldStatus;
  certifiedStandards: string[];
  waterSources: string[];
  irrigationType?: string;
  soilType?: string;
  lastSoilTestDate?: Date;
}

export interface UpdateOrganicFieldData {
  name?: string;
  localIdentifier?: string;
  cropType?: string;
  variety?: string;
  areaHectares?: number;
  boundaryGeoJson?: string;
  centerLat?: number;
  centerLng?: number;
  altitude?: number;
  organicSince?: Date;
  lastConventional?: Date;
  transitionEndDate?: Date;
  certificationStatus?: OrganicFieldStatus;
  certifiedStandards?: string[];
  waterSources?: string[];
  irrigationType?: string;
  soilType?: string;
  lastSoilTestDate?: Date;
  isActive?: boolean;
}

export interface OrganicFieldListResult {
  fields: OrganicField[];
  total: number;
}

export interface IOrganicFieldRepository {
  /**
   * Create a new organic field
   */
  create(data: CreateOrganicFieldData): Promise<OrganicField>;

  /**
   * Find organic field by ID
   */
  findById(id: string): Promise<OrganicField | null>;

  /**
   * Find organic field by base field ID
   */
  findByBaseFieldId(baseFieldId: string): Promise<OrganicField | null>;

  /**
   * List organic fields with filtering
   */
  list(filter: OrganicFieldFilter): Promise<OrganicFieldListResult>;

  /**
   * List organic fields for a producer
   */
  listByProducer(producerId: string, filter?: Omit<OrganicFieldFilter, 'producerId'>): Promise<OrganicFieldListResult>;

  /**
   * Update organic field
   */
  update(id: string, data: UpdateOrganicFieldData): Promise<OrganicField>;

  /**
   * Get organic field with inspection statistics
   */
  findByIdWithStats(id: string): Promise<OrganicFieldWithStats | null>;

  /**
   * Update certification status
   */
  updateCertificationStatus(id: string, status: OrganicFieldStatus): Promise<OrganicField>;

  /**
   * Add certified standard to field
   */
  addCertifiedStandard(id: string, standard: string): Promise<OrganicField>;

  /**
   * Remove certified standard from field
   */
  removeCertifiedStandard(id: string, standard: string): Promise<OrganicField>;

  /**
   * Soft delete (deactivate) a field
   */
  deactivate(id: string): Promise<OrganicField>;

  /**
   * Count active organic fields for a producer
   */
  countByProducer(producerId: string): Promise<number>;

  /**
   * Get fields ready for certification (completed transition)
   */
  getFieldsReadyForCertification(): Promise<OrganicField[]>;

  /**
   * Get fields with expiring certifications
   */
  getFieldsWithExpiringCertification(daysUntilExpiry: number): Promise<OrganicField[]>;

  /**
   * Check if point is within field boundary
   */
  isPointWithinBoundary(fieldId: string, lat: number, lng: number): Promise<boolean>;

  /**
   * Get total hectares by producer
   */
  getTotalHectaresByProducer(producerId: string): Promise<number>;
}
