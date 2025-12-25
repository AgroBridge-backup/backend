/**
 * FieldInspection Domain Entity
 * Inspection records with photo evidence and GPS verification
 * Supports routine, pre-certification, audit, and complaint inspections
 */

import { InspectionType } from './OrganicField.js';

export { InspectionType };

export interface InspectionPhoto {
  id: string;
  inspectionId: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  capturedAt: Date;
  caption?: string | null;
  photoType?: string | null;
  withinFieldBoundary: boolean;
  distanceFromField?: number | null;
  createdAt: Date;
}

export interface OrganicInput {
  id: string;
  inspectionId: string;
  productName: string;
  brandName?: string | null;
  manufacturer?: string | null;
  inputType: string;
  isOmriListed: boolean;
  isOrganicApproved: boolean;
  certificationNumber?: string | null;
  receiptUrl?: string | null;
  receiptDate?: Date | null;
  quantity?: string | null;
  supplier?: string | null;
  ocrExtractedData?: any | null;
  ocrConfidence?: number | null;
  verificationStatus: string;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt: Date;
}

export interface FieldActivity {
  id: string;
  inspectionId: string;
  activityType: string;
  description?: string | null;
  activityDate: Date;
  duration?: number | null;
  areaCovered?: number | null;
  workerCount?: number | null;
  notes?: string | null;
  createdAt: Date;
}

export interface FieldInspection {
  id: string;
  fieldId: string;
  inspectorId: string;
  inspectorName: string;
  inspectorRole: string;
  inspectionType: InspectionType;
  inspectionDate: Date;
  duration?: number | null;
  inspectorLat?: number | null;
  inspectorLng?: number | null;
  gpsAccuracy?: number | null;
  gpsVerified: boolean;
  weatherCondition?: string | null;
  temperature?: number | null;
  notes?: string | null;
  issues?: string | null;
  recommendations?: string | null;
  isVerified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldInspectionWithDetails extends FieldInspection {
  photos: InspectionPhoto[];
  organicInputs: OrganicInput[];
  activities: FieldActivity[];
}

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

export interface CreateInspectionPhotoInput {
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

export interface CreateOrganicInputInput {
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

export interface CreateFieldActivityInput {
  inspectionId: string;
  activityType: string;
  description?: string;
  activityDate: Date;
  duration?: number;
  areaCovered?: number;
  workerCount?: number;
  notes?: string;
}

export interface FieldInspectionFilter {
  fieldId?: string;
  inspectorId?: string;
  inspectionType?: InspectionType;
  isVerified?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

// Photo types for classification
export const PHOTO_TYPES = [
  'CROP',
  'INPUT',
  'PRACTICE',
  'ISSUE',
  'BOUNDARY',
  'GENERAL',
] as const;

// Input types for organic inputs
export const INPUT_TYPES = [
  'FERTILIZER',
  'PESTICIDE',
  'HERBICIDE',
  'FUNGICIDE',
  'SOIL_AMENDMENT',
  'SEED',
  'OTHER',
] as const;

// Activity types for field activities
export const ACTIVITY_TYPES = [
  'PLANTING',
  'SPRAYING',
  'HARVESTING',
  'PRUNING',
  'IRRIGATION',
  'WEEDING',
  'FERTILIZING',
  'PEST_CONTROL',
  'SOIL_PREPARATION',
  'OTHER',
] as const;

// Weather conditions
export const WEATHER_CONDITIONS = [
  'SUNNY',
  'CLOUDY',
  'PARTLY_CLOUDY',
  'RAINY',
  'FOGGY',
  'WINDY',
] as const;
