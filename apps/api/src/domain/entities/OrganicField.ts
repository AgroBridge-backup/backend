/**
 * OrganicField Domain Entity
 * Extended field entity for organic certification tracking
 * Tracks organic history, certification status, and inspection records
 */

export enum OrganicFieldStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION", // Newly declared, needs initial inspection
  TRANSITIONAL = "TRANSITIONAL", // In 36-month organic transition period
  CERTIFIED = "CERTIFIED", // Fully organic certified
  SUSPENDED = "SUSPENDED", // Certification suspended (violation)
  REVOKED = "REVOKED", // Certification revoked
}

export enum InspectionType {
  ROUTINE = "ROUTINE", // Regular weekly/monthly inspection by farmer
  PRE_CERTIFICATION = "PRE_CERTIFICATION", // Before issuing organic certificate
  AUDIT = "AUDIT", // Third-party audit inspection
  COMPLAINT = "COMPLAINT", // Investigation of complaint/issue
}

export interface OrganicField {
  id: string;

  // Link to base Field entity (for satellite imagery integration)
  baseFieldId?: string | null;

  // Producer ownership
  producerId: string;

  // Field identification
  name: string;
  localIdentifier?: string | null;

  // Crop information
  cropType: string;
  variety?: string | null;

  // Geographic boundaries
  areaHectares: number;
  boundaryGeoJson: string;
  centerLat: number;
  centerLng: number;
  altitude?: number | null;

  // Organic history
  organicSince?: Date | null;
  lastConventional?: Date | null;
  transitionEndDate?: Date | null;

  // Certification status
  certificationStatus: OrganicFieldStatus;
  certifiedStandards: string[];

  // Water sources
  waterSources: string[];
  irrigationType?: string | null;

  // Soil information
  soilType?: string | null;
  lastSoilTestDate?: Date | null;

  // Active status
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganicFieldInput {
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
  waterSources?: string[];
  irrigationType?: string;
  soilType?: string;
  lastSoilTestDate?: Date;
  certifiedStandards?: string[];
}

export interface UpdateOrganicFieldInput {
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

export interface OrganicFieldFilter {
  producerId?: string;
  certificationStatus?: OrganicFieldStatus;
  cropType?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface OrganicFieldWithStats extends OrganicField {
  inspectionCount: number;
  lastInspectionDate?: Date | null;
  daysSinceLastInspection?: number | null;
  transitionProgress?: number | null; // Percentage of 36-month transition complete
}

// Crop types supported for organic certification
export const SUPPORTED_CROP_TYPES = [
  "AVOCADO",
  "BLUEBERRY",
  "RASPBERRY",
  "STRAWBERRY",
  "BLACKBERRY",
] as const;

// Water source options
export const WATER_SOURCES = [
  "WELL",
  "RIVER",
  "RAIN",
  "MUNICIPAL",
  "RESERVOIR",
] as const;

// Irrigation types
export const IRRIGATION_TYPES = [
  "DRIP",
  "SPRINKLER",
  "FLOOD",
  "MICRO_SPRAY",
  "NONE",
] as const;

// Transition period for organic certification (36 months)
export const ORGANIC_TRANSITION_MONTHS = 36;
