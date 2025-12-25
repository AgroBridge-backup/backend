/**
 * Traceability 2.0 - Satellite Imagery Time-Lapse
 * Domain Entity for Field and Satellite Imagery
 */

export enum ImagerySource {
  SENTINEL_2 = 'SENTINEL_2',       // ESA Copernicus (free, 10m resolution)
  LANDSAT_8 = 'LANDSAT_8',         // NASA/USGS (free, 30m resolution)
  PLANET = 'PLANET',               // Planet Labs (commercial, 3m resolution)
  MAXAR = 'MAXAR',                 // Maxar (commercial, 30cm resolution)
  DRONE = 'DRONE',                 // User-uploaded drone imagery
}

export enum ImageryType {
  RGB = 'RGB',                     // True color
  NDVI = 'NDVI',                   // Normalized Difference Vegetation Index
  NDWI = 'NDWI',                   // Normalized Difference Water Index
  EVI = 'EVI',                     // Enhanced Vegetation Index
  SAVI = 'SAVI',                   // Soil Adjusted Vegetation Index
  FALSE_COLOR = 'FALSE_COLOR',     // Near-infrared false color
}

export enum FieldStatus {
  ACTIVE = 'ACTIVE',
  FALLOW = 'FALLOW',
  HARVESTED = 'HARVESTED',
  PREPARING = 'PREPARING',
}

export interface Field {
  id: string;
  producerId: string;
  name: string;
  description: string | null;
  status: FieldStatus;
  cropType: string | null;
  varietyName: string | null;
  plantingDate: Date | null;
  expectedHarvestDate: Date | null;
  areaHectares: number;
  boundaryGeoJson: GeoJsonPolygon;
  centroidLatitude: number;
  centroidLongitude: number;
  altitude: number | null;
  soilType: string | null;
  irrigationType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [[[lng, lat], [lng, lat], ...]]
}

export interface FieldImagery {
  id: string;
  fieldId: string;
  source: ImagerySource;
  imageType: ImageryType;
  captureDate: Date;
  cloudCoverPercent: number;
  resolution: number;            // meters per pixel
  imageUrl: string;
  thumbnailUrl: string | null;
  ndviValue: number | null;      // Average NDVI for field (-1 to 1)
  ndwiValue: number | null;      // Average NDWI for field
  healthScore: number | null;    // 0-100 computed health score
  anomalyDetected: boolean;
  anomalyDetails: string | null;
  metadata: ImageryMetadata;
  createdAt: Date;
}

export interface ImageryMetadata {
  satellite?: string;
  sensor?: string;
  orbitNumber?: number;
  processingLevel?: string;
  bands?: string[];
  atmosphericCorrection?: boolean;
  geometricCorrection?: boolean;
  customFields?: Record<string, unknown>;
}

export interface TimeLapseFrame {
  date: Date;
  imageUrl: string;
  ndviValue: number | null;
  healthScore: number | null;
  cloudCoverPercent: number;
}

export interface TimeLapse {
  fieldId: string;
  startDate: Date;
  endDate: Date;
  imageType: ImageryType;
  frames: TimeLapseFrame[];
  frameCount: number;
  averageNdvi: number | null;
  ndviTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
  healthTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
}

export interface HealthAnalysis {
  fieldId: string;
  analysisDate: Date;
  overallHealthScore: number;
  ndviAverage: number;
  ndviMin: number;
  ndviMax: number;
  healthDistribution: {
    excellent: number;  // % of field
    good: number;
    fair: number;
    poor: number;
    critical: number;
  };
  anomalies: Anomaly[];
  recommendations: string[];
}

export interface Anomaly {
  type: 'WATER_STRESS' | 'PEST_DAMAGE' | 'NUTRIENT_DEFICIENCY' | 'DISEASE' | 'UNEVEN_GROWTH' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedAreaHectares: number;
  affectedAreaPercent: number;
  location: { latitude: number; longitude: number };
  description: string;
  detectedAt: Date;
}

export interface CreateFieldInput {
  producerId: string;
  name: string;
  description?: string;
  cropType?: string;
  varietyName?: string;
  plantingDate?: Date;
  expectedHarvestDate?: Date;
  areaHectares: number;
  boundaryGeoJson: GeoJsonPolygon;
  altitude?: number;
  soilType?: string;
  irrigationType?: string;
}

export interface FetchImageryInput {
  fieldId: string;
  source: ImagerySource;
  imageType: ImageryType;
  startDate: Date;
  endDate: Date;
  maxCloudCover?: number;
}

/**
 * Imagery source display information
 */
export const IMAGERY_SOURCE_INFO: Record<ImagerySource, {
  displayName: string;
  description: string;
  resolution: string;
  revisitDays: number;
  isFree: boolean;
}> = {
  [ImagerySource.SENTINEL_2]: {
    displayName: 'Sentinel-2',
    description: 'ESA Copernicus satellite',
    resolution: '10m',
    revisitDays: 5,
    isFree: true,
  },
  [ImagerySource.LANDSAT_8]: {
    displayName: 'Landsat-8',
    description: 'NASA/USGS satellite',
    resolution: '30m',
    revisitDays: 16,
    isFree: true,
  },
  [ImagerySource.PLANET]: {
    displayName: 'Planet',
    description: 'Planet Labs constellation',
    resolution: '3m',
    revisitDays: 1,
    isFree: false,
  },
  [ImagerySource.MAXAR]: {
    displayName: 'Maxar',
    description: 'High-resolution commercial',
    resolution: '30cm',
    revisitDays: 1,
    isFree: false,
  },
  [ImagerySource.DRONE]: {
    displayName: 'Dron',
    description: 'Imágenes de dron subidas',
    resolution: 'Variable',
    revisitDays: 0,
    isFree: true,
  },
};

/**
 * Image type display information
 */
export const IMAGE_TYPE_INFO: Record<ImageryType, {
  displayName: string;
  description: string;
  useCases: string[];
}> = {
  [ImageryType.RGB]: {
    displayName: 'Color Real',
    description: 'Vista de color verdadero',
    useCases: ['Inspección visual', 'Documentación'],
  },
  [ImageryType.NDVI]: {
    displayName: 'NDVI',
    description: 'Índice de vegetación normalizado',
    useCases: ['Salud de cultivos', 'Detección de estrés'],
  },
  [ImageryType.NDWI]: {
    displayName: 'NDWI',
    description: 'Índice de agua normalizado',
    useCases: ['Contenido de agua', 'Detección de riego'],
  },
  [ImageryType.EVI]: {
    displayName: 'EVI',
    description: 'Índice de vegetación mejorado',
    useCases: ['Biomasa', 'Cobertura vegetal densa'],
  },
  [ImageryType.SAVI]: {
    displayName: 'SAVI',
    description: 'Índice ajustado por suelo',
    useCases: ['Cultivos jóvenes', 'Cobertura escasa'],
  },
  [ImageryType.FALSE_COLOR]: {
    displayName: 'Falso Color',
    description: 'Infrarrojo cercano',
    useCases: ['Detección de vegetación', 'Límites de campo'],
  },
};

/**
 * Calculate NDVI from red and NIR bands
 * NDVI = (NIR - Red) / (NIR + Red)
 */
export function calculateNdvi(redBand: number, nirBand: number): number {
  if (nirBand + redBand === 0) return 0;
  return (nirBand - redBand) / (nirBand + redBand);
}

/**
 * Calculate NDWI from green and NIR bands
 * NDWI = (Green - NIR) / (Green + NIR)
 */
export function calculateNdwi(greenBand: number, nirBand: number): number {
  if (greenBand + nirBand === 0) return 0;
  return (greenBand - nirBand) / (greenBand + nirBand);
}

/**
 * Calculate EVI from blue, red, and NIR bands
 * EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
 */
export function calculateEvi(blueBand: number, redBand: number, nirBand: number): number {
  const denominator = nirBand + 6 * redBand - 7.5 * blueBand + 1;
  if (denominator === 0) return 0;
  return 2.5 * (nirBand - redBand) / denominator;
}

/**
 * Convert NDVI value to health score (0-100)
 */
export function ndviToHealthScore(ndvi: number): number {
  if (ndvi < 0) return 0;
  if (ndvi < 0.2) return Math.round(ndvi * 100); // 0-20: Poor
  if (ndvi < 0.4) return Math.round(20 + (ndvi - 0.2) * 150); // 20-50: Fair
  if (ndvi < 0.6) return Math.round(50 + (ndvi - 0.4) * 150); // 50-80: Good
  if (ndvi < 0.8) return Math.round(80 + (ndvi - 0.6) * 75); // 80-95: Very Good
  return Math.min(100, Math.round(95 + (ndvi - 0.8) * 25)); // 95-100: Excellent
}

/**
 * Get health category from score
 */
export function getHealthCategory(score: number): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  if (score >= 20) return 'POOR';
  return 'CRITICAL';
}

/**
 * Determine NDVI trend from time series
 */
export function calculateNdviTrend(values: number[]): 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN' {
  if (values.length < 3) return 'UNKNOWN';

  // Simple linear regression
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  if (slope > 0.01) return 'IMPROVING';
  if (slope < -0.01) return 'DECLINING';
  return 'STABLE';
}

/**
 * Validate GeoJSON polygon
 */
export function isValidGeoJsonPolygon(geoJson: GeoJsonPolygon): boolean {
  if (geoJson.type !== 'Polygon') return false;
  if (!Array.isArray(geoJson.coordinates) || geoJson.coordinates.length === 0) return false;

  const ring = geoJson.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return false; // Minimum 3 points + closing

  // Check first and last points are the same (closed ring)
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return false;

  // Validate coordinate ranges
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) return false;
    const [lng, lat] = point;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  }

  return true;
}

/**
 * Calculate centroid of polygon
 */
export function calculateCentroid(polygon: GeoJsonPolygon): { latitude: number; longitude: number } {
  const ring = polygon.coordinates[0];
  let sumLat = 0;
  let sumLng = 0;

  // Exclude closing point
  for (let i = 0; i < ring.length - 1; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }

  const count = ring.length - 1;
  return {
    latitude: sumLat / count,
    longitude: sumLng / count,
  };
}

/**
 * Calculate polygon area in hectares using Shoelace formula
 * Note: This is approximate for small areas; for precise calculations use proper GIS libraries
 */
export function calculateAreaHectares(polygon: GeoJsonPolygon): number {
  const ring = polygon.coordinates[0];

  // Need at least 3 points (plus closing point) to form a polygon
  if (ring.length < 4) return 0;

  const { latitude } = calculateCentroid(polygon);

  // Convert to approximate meters using latitude correction
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(latitude * Math.PI / 180);

  let area = 0;
  const n = ring.length - 1; // Exclude closing point (same as first)

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = ring[i][0] * metersPerDegreeLng;
    const y1 = ring[i][1] * metersPerDegreeLat;
    const x2 = ring[j][0] * metersPerDegreeLng;
    const y2 = ring[j][1] * metersPerDegreeLat;

    area += x1 * y2 - x2 * y1;
  }

  // Convert square meters to hectares
  return Math.abs(area / 2) / 10000;
}
