/**
 * Field Inspection Use Cases
 * Application layer for field inspection operations
 */

import { FieldInspectionService } from '../../../domain/services/FieldInspectionService.js';
import {
  FieldInspection,
  FieldInspectionWithDetails,
  FieldInspectionFilter,
  InspectionPhoto,
  OrganicInput,
  FieldActivity,
  InspectionType,
} from '../../../domain/entities/FieldInspection.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE FIELD INSPECTION USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateFieldInspectionInput {
  fieldId: string;
  inspectorId: string;
  inspectorName: string;
  inspectorRole: string;
  inspectionType?: InspectionType;
  inspectionDate?: Date;
  duration?: number;
  inspectorLat?: number;
  inspectorLng?: number;
  gpsAccuracy?: number;
  weatherCondition?: string;
  temperature?: number;
  notes?: string;
  issues?: string;
  recommendations?: string;
}

export interface CreateFieldInspectionOutput {
  inspection: FieldInspection;
  gpsVerified: boolean;
  message: string;
}

export class CreateFieldInspectionUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: CreateFieldInspectionInput): Promise<CreateFieldInspectionOutput> {
    return this.service.createInspection(input);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET FIELD INSPECTION USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface GetFieldInspectionInput {
  inspectionId: string;
  includeDetails?: boolean;
}

export interface GetFieldInspectionOutput {
  inspection: FieldInspection | FieldInspectionWithDetails;
}

export class GetFieldInspectionUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: GetFieldInspectionInput): Promise<GetFieldInspectionOutput> {
    const inspection = input.includeDetails
      ? await this.service.getInspectionWithDetails(input.inspectionId)
      : await this.service.getInspection(input.inspectionId);

    if (!inspection) {
      throw new Error(`Inspection not found: ${input.inspectionId}`);
    }

    return { inspection };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST FIELD INSPECTIONS USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ListFieldInspectionsInput {
  fieldId?: string;
  inspectorId?: string;
  inspectionType?: InspectionType;
  isVerified?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ListFieldInspectionsOutput {
  inspections: FieldInspection[];
  total: number;
  limit: number;
  offset: number;
}

export class ListFieldInspectionsUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: ListFieldInspectionsInput): Promise<ListFieldInspectionsOutput> {
    const filter: FieldInspectionFilter = {
      fieldId: input.fieldId,
      inspectorId: input.inspectorId,
      inspectionType: input.inspectionType,
      isVerified: input.isVerified,
      fromDate: input.fromDate,
      toDate: input.toDate,
      limit: input.limit || 50,
      offset: input.offset || 0,
    };

    const result = input.fieldId
      ? await this.service.listFieldInspections(input.fieldId, filter)
      : await this.service.listInspections(filter);

    return {
      inspections: result.inspections,
      total: result.total,
      limit: filter.limit!,
      offset: filter.offset!,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE INSPECTION NOTES USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface UpdateInspectionNotesInput {
  inspectionId: string;
  notes?: string;
  issues?: string;
  recommendations?: string;
}

export interface UpdateInspectionNotesOutput {
  inspection: FieldInspection;
  message: string;
}

export class UpdateInspectionNotesUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: UpdateInspectionNotesInput): Promise<UpdateInspectionNotesOutput> {
    const inspection = await this.service.updateInspectionNotes(
      input.inspectionId,
      input.notes,
      input.issues,
      input.recommendations
    );

    return {
      inspection,
      message: 'Inspection notes updated successfully',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY FIELD INSPECTION USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerifyFieldInspectionInput {
  inspectionId: string;
  verifiedBy: string;
}

export interface VerifyFieldInspectionOutput {
  inspection: FieldInspection;
  message: string;
}

export class VerifyFieldInspectionUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: VerifyFieldInspectionInput): Promise<VerifyFieldInspectionOutput> {
    return this.service.verifyInspection(input.inspectionId, input.verifiedBy);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD INSPECTION PHOTO USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AddInspectionPhotoInput {
  inspectionId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  capturedAt: Date;
  caption?: string;
  photoType?: string;
}

export interface AddInspectionPhotoOutput {
  photo: InspectionPhoto;
  withinBoundary: boolean;
  distanceFromField?: number;
  message: string;
}

export class AddInspectionPhotoUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: AddInspectionPhotoInput): Promise<AddInspectionPhotoOutput> {
    const result = await this.service.addPhoto(input);

    return {
      photo: result.photo,
      withinBoundary: result.withinBoundary,
      distanceFromField: result.distanceFromField,
      message: result.withinBoundary
        ? 'Photo added with verified location'
        : result.distanceFromField
          ? `Photo added but location is ${Math.round(result.distanceFromField)}m from field center`
          : 'Photo added without GPS verification',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD ORGANIC INPUT USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AddOrganicInputInput {
  inspectionId: string;
  productName: string;
  brandName?: string;
  manufacturer?: string;
  inputType: string;
  isOmriListed?: boolean;
  isOrganicApproved?: boolean;
  certificationNumber?: string;
  receiptUrl?: string;
  receiptDate?: Date;
  quantity?: string;
  supplier?: string;
  ocrExtractedData?: any;
  ocrConfidence?: number;
}

export interface AddOrganicInputOutput {
  organicInput: OrganicInput;
  message: string;
}

export class AddOrganicInputUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: AddOrganicInputInput): Promise<AddOrganicInputOutput> {
    return this.service.addOrganicInput(input);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY ORGANIC INPUT USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerifyOrganicInputInput {
  inputId: string;
  verifiedBy: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface VerifyOrganicInputOutput {
  organicInput: OrganicInput;
  message: string;
}

export class VerifyOrganicInputUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: VerifyOrganicInputInput): Promise<VerifyOrganicInputOutput> {
    return this.service.verifyOrganicInput(
      input.inputId,
      input.verifiedBy,
      input.approved,
      input.rejectionReason
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD FIELD ACTIVITY USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AddFieldActivityInput {
  inspectionId: string;
  activityType: string;
  description?: string;
  activityDate: Date;
  duration?: number;
  areaCovered?: number;
  workerCount?: number;
  notes?: string;
}

export interface AddFieldActivityOutput {
  activity: FieldActivity;
  message: string;
}

export class AddFieldActivityUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: AddFieldActivityInput): Promise<AddFieldActivityOutput> {
    return this.service.addActivity(input);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET FIELD INSPECTION STATS USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

export interface GetFieldInspectionStatsInput {
  fieldId: string;
}

export interface GetFieldInspectionStatsOutput {
  total: number;
  verified: number;
  unverified: number;
  byType: Record<InspectionType, number>;
  lastInspectionDate: Date | null;
  needsInspection: boolean;
  daysSinceLastInspection: number | null;
}

export class GetFieldInspectionStatsUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: GetFieldInspectionStatsInput): Promise<GetFieldInspectionStatsOutput> {
    const [stats, needsInspection] = await Promise.all([
      this.service.getFieldInspectionStats(input.fieldId),
      this.service.fieldNeedsInspection(input.fieldId, 30),
    ]);

    return {
      ...stats,
      needsInspection: needsInspection.needsInspection,
      daysSinceLastInspection: needsInspection.daysSinceLastInspection,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET INSPECTION DETAILS USE CASE (Photos, Inputs, Activities)
// ═══════════════════════════════════════════════════════════════════════════════

export interface GetInspectionDetailsInput {
  inspectionId: string;
}

export interface GetInspectionDetailsOutput {
  photos: InspectionPhoto[];
  organicInputs: OrganicInput[];
  activities: FieldActivity[];
}

export class GetInspectionDetailsUseCase {
  constructor(private readonly service: FieldInspectionService) {}

  async execute(input: GetInspectionDetailsInput): Promise<GetInspectionDetailsOutput> {
    const [photos, organicInputs, activities] = await Promise.all([
      this.service.getInspectionPhotos(input.inspectionId),
      this.service.getOrganicInputs(input.inspectionId),
      this.service.getActivities(input.inspectionId),
    ]);

    return { photos, organicInputs, activities };
  }
}
