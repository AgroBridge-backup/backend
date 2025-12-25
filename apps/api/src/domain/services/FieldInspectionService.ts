/**
 * FieldInspection Domain Service
 * Business logic for field inspection management
 * Handles inspection creation, photo evidence, organic input tracking, and verification
 */

import { v4 as uuidv4 } from 'uuid';
import {
  IFieldInspectionRepository,
  CreateFieldInspectionData,
  CreateInspectionPhotoData,
  CreateOrganicInputData,
  CreateFieldActivityData,
} from '../repositories/IFieldInspectionRepository.js';
import {
  FieldInspection,
  FieldInspectionWithDetails,
  FieldInspectionFilter,
  InspectionPhoto,
  OrganicInput,
  FieldActivity,
  CreateFieldInspectionInput,
  CreateInspectionPhotoInput,
  CreateOrganicInputInput,
  CreateFieldActivityInput,
  InspectionType,
} from '../entities/FieldInspection.js';
import { IOrganicFieldRepository } from '../repositories/IOrganicFieldRepository.js';

export interface FieldInspectionServiceDeps {
  inspectionRepository: IFieldInspectionRepository;
  fieldRepository: IOrganicFieldRepository;
}

export class FieldInspectionService {
  private readonly inspectionRepository: IFieldInspectionRepository;
  private readonly fieldRepository: IOrganicFieldRepository;

  constructor(deps: FieldInspectionServiceDeps) {
    this.inspectionRepository = deps.inspectionRepository;
    this.fieldRepository = deps.fieldRepository;
  }

  /**
   * Create a new field inspection
   * Validates field exists and GPS coordinates if provided
   */
  async createInspection(input: CreateFieldInspectionInput): Promise<{
    inspection: FieldInspection;
    gpsVerified: boolean;
    message: string;
  }> {
    // Verify field exists
    const field = await this.fieldRepository.findById(input.fieldId);
    if (!field) {
      throw new Error(`Field not found: ${input.fieldId}`);
    }

    // Verify GPS location if coordinates provided
    let gpsVerified = false;
    if (input.inspectorLat !== undefined && input.inspectorLng !== undefined) {
      gpsVerified = await this.fieldRepository.isPointWithinBoundary(
        input.fieldId,
        input.inspectorLat,
        input.inspectorLng
      );
    }

    const data: CreateFieldInspectionData = {
      id: uuidv4(),
      fieldId: input.fieldId,
      inspectorId: input.inspectorId,
      inspectorName: input.inspectorName,
      inspectorRole: input.inspectorRole,
      inspectionType: input.inspectionType || InspectionType.ROUTINE,
      inspectionDate: input.inspectionDate || new Date(),
      duration: input.duration,
      inspectorLat: input.inspectorLat,
      inspectorLng: input.inspectorLng,
      gpsAccuracy: input.gpsAccuracy,
      gpsVerified,
      weatherCondition: input.weatherCondition,
      temperature: input.temperature,
      notes: input.notes,
      issues: input.issues,
      recommendations: input.recommendations,
    };

    const inspection = await this.inspectionRepository.create(data);

    return {
      inspection,
      gpsVerified,
      message: gpsVerified
        ? 'Inspection created with verified GPS location'
        : input.inspectorLat !== undefined
          ? 'Inspection created but GPS location is outside field boundary'
          : 'Inspection created without GPS verification',
    };
  }

  /**
   * Get inspection by ID
   */
  async getInspection(id: string): Promise<FieldInspection | null> {
    return this.inspectionRepository.findById(id);
  }

  /**
   * Get inspection with all details (photos, inputs, activities)
   */
  async getInspectionWithDetails(id: string): Promise<FieldInspectionWithDetails | null> {
    return this.inspectionRepository.findByIdWithDetails(id);
  }

  /**
   * List inspections with filtering
   */
  async listInspections(filter: FieldInspectionFilter): Promise<{
    inspections: FieldInspection[];
    total: number;
  }> {
    const result = await this.inspectionRepository.list(filter);
    return {
      inspections: result.inspections,
      total: result.total,
    };
  }

  /**
   * List inspections for a specific field
   */
  async listFieldInspections(
    fieldId: string,
    filter?: Omit<FieldInspectionFilter, 'fieldId'>
  ): Promise<{
    inspections: FieldInspection[];
    total: number;
  }> {
    const result = await this.inspectionRepository.listByField(fieldId, filter);
    return {
      inspections: result.inspections,
      total: result.total,
    };
  }

  /**
   * Update inspection notes, issues, and recommendations
   */
  async updateInspectionNotes(
    id: string,
    notes?: string,
    issues?: string,
    recommendations?: string
  ): Promise<FieldInspection> {
    const inspection = await this.inspectionRepository.findById(id);
    if (!inspection) {
      throw new Error(`Inspection not found: ${id}`);
    }

    return this.inspectionRepository.updateNotes(id, notes, issues, recommendations);
  }

  /**
   * Verify an inspection (by supervisor/certifier)
   */
  async verifyInspection(id: string, verifiedBy: string): Promise<{
    inspection: FieldInspection;
    message: string;
  }> {
    const inspection = await this.inspectionRepository.findById(id);
    if (!inspection) {
      throw new Error(`Inspection not found: ${id}`);
    }

    if (inspection.isVerified) {
      throw new Error('Inspection is already verified');
    }

    const verifiedInspection = await this.inspectionRepository.verify(id, verifiedBy);

    return {
      inspection: verifiedInspection,
      message: 'Inspection verified successfully',
    };
  }

  /**
   * Add photo to inspection with optional GPS verification
   */
  async addPhoto(input: CreateInspectionPhotoInput): Promise<{
    photo: InspectionPhoto;
    withinBoundary: boolean;
    distanceFromField?: number;
  }> {
    const inspection = await this.inspectionRepository.findById(input.inspectionId);
    if (!inspection) {
      throw new Error(`Inspection not found: ${input.inspectionId}`);
    }

    // Check if photo location is within field boundary
    let withinBoundary = true;
    let distanceFromField: number | undefined;

    if (input.latitude !== undefined && input.longitude !== undefined) {
      withinBoundary = await this.fieldRepository.isPointWithinBoundary(
        inspection.fieldId,
        input.latitude,
        input.longitude
      );

      if (!withinBoundary) {
        // Calculate distance from field center
        const field = await this.fieldRepository.findById(inspection.fieldId);
        if (field) {
          distanceFromField = this.haversineDistance(
            input.latitude,
            input.longitude,
            field.centerLat,
            field.centerLng
          );
        }
      }
    }

    const data: CreateInspectionPhotoData = {
      id: uuidv4(),
      inspectionId: input.inspectionId,
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude: input.altitude,
      capturedAt: input.capturedAt,
      caption: input.caption,
      photoType: input.photoType,
      withinFieldBoundary: withinBoundary,
      distanceFromField,
    };

    const photo = await this.inspectionRepository.addPhoto(data);

    return {
      photo,
      withinBoundary,
      distanceFromField,
    };
  }

  /**
   * Add organic input record to inspection
   */
  async addOrganicInput(input: CreateOrganicInputInput): Promise<{
    organicInput: OrganicInput;
    message: string;
  }> {
    const inspection = await this.inspectionRepository.findById(input.inspectionId);
    if (!inspection) {
      throw new Error(`Inspection not found: ${input.inspectionId}`);
    }

    const data: CreateOrganicInputData = {
      id: uuidv4(),
      inspectionId: input.inspectionId,
      productName: input.productName,
      brandName: input.brandName,
      manufacturer: input.manufacturer,
      inputType: input.inputType,
      isOmriListed: input.isOmriListed ?? false,
      isOrganicApproved: input.isOrganicApproved ?? false,
      certificationNumber: input.certificationNumber,
      receiptUrl: input.receiptUrl,
      receiptDate: input.receiptDate,
      quantity: input.quantity,
      supplier: input.supplier,
      ocrExtractedData: input.ocrExtractedData,
      ocrConfidence: input.ocrConfidence,
      verificationStatus: 'PENDING',
    };

    const organicInput = await this.inspectionRepository.addOrganicInput(data);

    return {
      organicInput,
      message: organicInput.isOmriListed || organicInput.isOrganicApproved
        ? 'Organic input recorded with certification'
        : 'Organic input recorded - pending verification',
    };
  }

  /**
   * Verify organic input (approve or reject)
   */
  async verifyOrganicInput(
    inputId: string,
    verifiedBy: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<{
    organicInput: OrganicInput;
    message: string;
  }> {
    const organicInput = await this.inspectionRepository.verifyOrganicInput(
      inputId,
      verifiedBy,
      approved,
      rejectionReason
    );

    return {
      organicInput,
      message: approved
        ? 'Organic input verified and approved'
        : `Organic input rejected: ${rejectionReason || 'No reason provided'}`,
    };
  }

  /**
   * Add field activity record to inspection
   */
  async addActivity(input: CreateFieldActivityInput): Promise<{
    activity: FieldActivity;
    message: string;
  }> {
    const inspection = await this.inspectionRepository.findById(input.inspectionId);
    if (!inspection) {
      throw new Error(`Inspection not found: ${input.inspectionId}`);
    }

    const data: CreateFieldActivityData = {
      id: uuidv4(),
      inspectionId: input.inspectionId,
      activityType: input.activityType,
      description: input.description,
      activityDate: input.activityDate,
      duration: input.duration,
      areaCovered: input.areaCovered,
      workerCount: input.workerCount,
      notes: input.notes,
    };

    const activity = await this.inspectionRepository.addActivity(data);

    return {
      activity,
      message: `Field activity '${input.activityType}' recorded`,
    };
  }

  /**
   * Get inspection photos
   */
  async getInspectionPhotos(inspectionId: string): Promise<InspectionPhoto[]> {
    return this.inspectionRepository.getPhotos(inspectionId);
  }

  /**
   * Get organic inputs for inspection
   */
  async getOrganicInputs(inspectionId: string): Promise<OrganicInput[]> {
    return this.inspectionRepository.getOrganicInputs(inspectionId);
  }

  /**
   * Get activities for inspection
   */
  async getActivities(inspectionId: string): Promise<FieldActivity[]> {
    return this.inspectionRepository.getActivities(inspectionId);
  }

  /**
   * Get inspection statistics for a field
   */
  async getFieldInspectionStats(fieldId: string): Promise<{
    total: number;
    verified: number;
    unverified: number;
    byType: Record<InspectionType, number>;
    lastInspectionDate: Date | null;
  }> {
    return this.inspectionRepository.getFieldInspectionStats(fieldId);
  }

  /**
   * Get inspection count for a field
   */
  async getInspectionCount(fieldId: string): Promise<number> {
    return this.inspectionRepository.countByField(fieldId);
  }

  /**
   * Get last inspection date for a field
   */
  async getLastInspectionDate(fieldId: string): Promise<Date | null> {
    return this.inspectionRepository.getLastInspectionDate(fieldId);
  }

  /**
   * Check if field needs inspection (based on days since last inspection)
   */
  async fieldNeedsInspection(fieldId: string, maxDaysSinceInspection: number = 30): Promise<{
    needsInspection: boolean;
    daysSinceLastInspection: number | null;
    lastInspectionDate: Date | null;
  }> {
    const lastInspectionDate = await this.inspectionRepository.getLastInspectionDate(fieldId);

    if (!lastInspectionDate) {
      return {
        needsInspection: true,
        daysSinceLastInspection: null,
        lastInspectionDate: null,
      };
    }

    const daysSinceLastInspection = Math.floor(
      (Date.now() - lastInspectionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      needsInspection: daysSinceLastInspection >= maxDaysSinceInspection,
      daysSinceLastInspection,
      lastInspectionDate,
    };
  }

  /**
   * Calculate Haversine distance between two GPS coordinates (in meters)
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
