/**
 * FieldInspection Repository Interface
 * Defines the contract for field inspection data access
 */

import {
  FieldInspection,
  FieldInspectionWithDetails,
  FieldInspectionFilter,
  InspectionPhoto,
  OrganicInput,
  FieldActivity,
  InspectionType,
} from "../entities/FieldInspection.js";

export interface CreateFieldInspectionData {
  id: string;
  fieldId: string;
  inspectorId: string;
  inspectorName: string;
  inspectorRole: string;
  inspectionType: InspectionType;
  inspectionDate: Date;
  duration?: number;
  inspectorLat?: number;
  inspectorLng?: number;
  gpsAccuracy?: number;
  gpsVerified: boolean;
  weatherCondition?: string;
  temperature?: number;
  notes?: string;
  issues?: string;
  recommendations?: string;
}

export interface CreateInspectionPhotoData {
  id: string;
  inspectionId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  capturedAt: Date;
  caption?: string;
  photoType?: string;
  withinFieldBoundary: boolean;
  distanceFromField?: number;
}

export interface CreateOrganicInputData {
  id: string;
  inspectionId: string;
  productName: string;
  brandName?: string;
  manufacturer?: string;
  inputType: string;
  isOmriListed: boolean;
  isOrganicApproved: boolean;
  certificationNumber?: string;
  receiptUrl?: string;
  receiptDate?: Date;
  quantity?: string;
  supplier?: string;
  ocrExtractedData?: any;
  ocrConfidence?: number;
  verificationStatus: string;
}

export interface CreateFieldActivityData {
  id: string;
  inspectionId: string;
  activityType: string;
  description?: string;
  activityDate: Date;
  duration?: number;
  areaCovered?: number;
  workerCount?: number;
  notes?: string;
}

export interface FieldInspectionListResult {
  inspections: FieldInspection[];
  total: number;
}

export interface IFieldInspectionRepository {
  /**
   * Create a new field inspection
   */
  create(data: CreateFieldInspectionData): Promise<FieldInspection>;

  /**
   * Find inspection by ID
   */
  findById(id: string): Promise<FieldInspection | null>;

  /**
   * Find inspection by ID with all details (photos, inputs, activities)
   */
  findByIdWithDetails(id: string): Promise<FieldInspectionWithDetails | null>;

  /**
   * List inspections with filtering
   */
  list(filter: FieldInspectionFilter): Promise<FieldInspectionListResult>;

  /**
   * List inspections for a field
   */
  listByField(
    fieldId: string,
    filter?: Omit<FieldInspectionFilter, "fieldId">,
  ): Promise<FieldInspectionListResult>;

  /**
   * Update inspection notes/issues/recommendations
   */
  updateNotes(
    id: string,
    notes?: string,
    issues?: string,
    recommendations?: string,
  ): Promise<FieldInspection>;

  /**
   * Verify inspection
   */
  verify(id: string, verifiedBy: string): Promise<FieldInspection>;

  /**
   * Add photo to inspection
   */
  addPhoto(data: CreateInspectionPhotoData): Promise<InspectionPhoto>;

  /**
   * Add organic input to inspection
   */
  addOrganicInput(data: CreateOrganicInputData): Promise<OrganicInput>;

  /**
   * Add activity to inspection
   */
  addActivity(data: CreateFieldActivityData): Promise<FieldActivity>;

  /**
   * Get photos for inspection
   */
  getPhotos(inspectionId: string): Promise<InspectionPhoto[]>;

  /**
   * Get organic inputs for inspection
   */
  getOrganicInputs(inspectionId: string): Promise<OrganicInput[]>;

  /**
   * Get activities for inspection
   */
  getActivities(inspectionId: string): Promise<FieldActivity[]>;

  /**
   * Verify organic input
   */
  verifyOrganicInput(
    inputId: string,
    verifiedBy: string,
    approved: boolean,
    rejectionReason?: string,
  ): Promise<OrganicInput>;

  /**
   * Count inspections for a field
   */
  countByField(fieldId: string): Promise<number>;

  /**
   * Get last inspection date for a field
   */
  getLastInspectionDate(fieldId: string): Promise<Date | null>;

  /**
   * Get inspection statistics for a field
   */
  getFieldInspectionStats(fieldId: string): Promise<{
    total: number;
    verified: number;
    unverified: number;
    byType: Record<InspectionType, number>;
    lastInspectionDate: Date | null;
  }>;
}
