/**
 * Smart-Cold Chain Protocol Domain Models
 *
 * IoT-enabled cold chain monitoring and agronomic quality verification
 * for US/EU export compliance.
 *
 * Key Features:
 * - Real-time temperature/humidity monitoring (1-minute intervals)
 * - Brix/pH digital verification (instant vs 3-day lab)
 * - Cold chain compliance scoring (0-100)
 * - Automated breach detection and alerts
 *
 * @module SmartColdChain
 */

// ════════════════════════════════════════════════════════════════════════════════
// ENUMS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * IoT Sensor status
 */
export enum SensorStatus {
  ACTIVE = "ACTIVE",
  OFFLINE = "OFFLINE",
  LOW_BATTERY = "LOW_BATTERY",
  MAINTENANCE = "MAINTENANCE",
  DECOMMISSIONED = "DECOMMISSIONED",
}

/**
 * Cold chain session type
 */
export enum SessionType {
  FIELD_MONITORING = "FIELD_MONITORING",
  HARVEST_COOLING = "HARVEST_COOLING",
  COLD_STORAGE = "COLD_STORAGE",
  TRANSPORT = "TRANSPORT",
}

/**
 * Cold chain session status
 */
export enum ColdChainSessionStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  BREACHED = "BREACHED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  EXPIRED = "EXPIRED",
}

/**
 * Quality grade for export eligibility
 */
export enum QualityGradeType {
  PREMIUM = "PREMIUM", // A++ Export quality (top 10%)
  EXPORT = "EXPORT", // A/B Export standard
  DOMESTIC = "DOMESTIC", // B/C Domestic market only
  REJECT = "REJECT", // Below standard - not sellable
}

/**
 * Breach type classification
 */
export enum BreachType {
  OVER_TEMP = "OVER_TEMP",
  UNDER_TEMP = "UNDER_TEMP",
  HUMIDITY_HIGH = "HUMIDITY_HIGH",
  HUMIDITY_LOW = "HUMIDITY_LOW",
}

/**
 * Breach severity levels
 */
export enum BreachSeverity {
  LOW = "LOW", // <1°C deviation, <10 min
  MEDIUM = "MEDIUM", // 1-3°C deviation, 10-30 min
  HIGH = "HIGH", // 3-5°C deviation, 30-60 min
  CRITICAL = "CRITICAL", // >5°C deviation or >60 min
}

/**
 * Alert types for notification system
 */
export enum AlertType {
  TEMPERATURE_BREACH = "TEMPERATURE_BREACH",
  HUMIDITY_BREACH = "HUMIDITY_BREACH",
  SENSOR_OFFLINE = "SENSOR_OFFLINE",
  QUALITY_DECLINE = "QUALITY_DECLINE",
  BATTERY_LOW = "BATTERY_LOW",
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

/**
 * Crop types with cold chain requirements
 */
export enum CropType {
  AVOCADO = "AVOCADO",
  BLUEBERRY = "BLUEBERRY",
  STRAWBERRY = "STRAWBERRY",
  RASPBERRY = "RASPBERRY",
  COFFEE = "COFFEE",
  CACAO = "CACAO",
}

// ════════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * IoT Sensor device
 */
export interface IoTSensor {
  id: string;
  deviceId: string; // MAC address or serial number
  deviceType: string; // TEMP_HUMIDITY, BRIX_METER, MULTIFUNCTION
  manufacturer?: string; // SensorPush, Hanna Instruments, etc.
  firmwareVersion?: string;

  exportCompanyId: string;

  // Current assignment
  assignedTo?: string; // fieldId or shipmentId
  assignedType?: "FIELD" | "SHIPMENT" | "STORAGE";

  status: SensorStatus;
  lastReading?: Date;
  batteryLevel?: number; // 0-100

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sensor reading from IoT device
 */
export interface SensorReading {
  id: string;
  sensorId: string;
  sessionId?: string;
  fieldId?: string;
  shipmentId?: string;

  // Environmental data
  temperature: number; // Celsius (-40 to 100)
  humidity?: number; // Percentage 0-100
  batteryLevel?: number; // 0-100

  // Quality metrics (if sensor supports)
  brixLevel?: number; // Sugar content °Brix (0-30)
  phLevel?: number; // Acidity 0-14
  firmness?: number; // Newton force

  // Location
  gpsLat?: number;
  gpsLon?: number;

  // Compliance flags
  temperatureInRange: boolean;
  humidityInRange: boolean;
  qualityGrade?: QualityGradeType;

  readingTime: Date;
  createdAt: Date;
}

/**
 * Cold chain monitoring session
 */
export interface ColdChainSession {
  id: string;
  sessionType: SessionType;

  // Relationships
  exportCompanyId: string;
  fieldId?: string;
  shipmentId?: string;
  batchId?: string;
  certificateId?: string;

  // Sensors assigned
  sensorIds: string[];

  // Time bounds
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;

  // Crop-specific thresholds
  cropType: CropType;
  minTemperature: number;
  maxTemperature: number;
  targetHumidity: number;

  // Computed metrics
  totalReadings: number;
  compliantReadings: number;
  complianceScore: number; // 0-100
  breachCount: number;
  maxTemperatureBreach?: number;
  breachDurationMinutes?: number;

  // Quality scores
  avgBrixLevel?: number;
  avgPhLevel?: number;
  qualityGrade?: QualityGradeType;

  // Report artifacts
  complianceReportUrl?: string;
  chartImageUrl?: string;
  rawDataCsvUrl?: string;

  status: ColdChainSessionStatus;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Temperature/humidity breach event
 */
export interface TemperatureBreach {
  id: string;
  sessionId: string;

  breachType: BreachType;
  severity: BreachSeverity;

  startTime: Date;
  endTime?: Date;
  durationMinutes: number;

  threshold: number;
  peakValue: number;
  avgValue: number;

  // Actions taken
  alertSent: boolean;
  alertedUsers: string[];
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;

  createdAt: Date;
}

/**
 * Smart cold chain alert
 */
export interface SmartColdAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;

  sessionId: string;
  sensorId: string;

  message: string;
  messageLang: "es" | "en";

  currentValue: number;
  threshold: number;
  timestamp: Date;

  sent: boolean;
  sentVia: ("EMAIL" | "SMS" | "PUSH" | "WEBHOOK")[];
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Quality metrics for harvest
 */
export interface QualityMetrics {
  id: string;
  fieldId: string;
  batchId?: string;
  harvestDate: Date;
  cropType: CropType;

  // Brix (sugar content)
  brixLevel: number;
  brixGrade: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  brixCompliant: boolean;

  // pH (acidity)
  phLevel: number;
  phGrade: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  phCompliant: boolean;

  // Physical attributes
  firmness?: number;
  color?: string;
  diameter?: number;
  weight?: number;

  // Defects
  defectCount: number;
  defectTypes: string[];

  // Final grade
  overallQuality: QualityGradeType;
  exportEligible: boolean;
  marketPrice?: number; // USD/kg estimated

  // Lab verification
  labVerified: boolean;
  labReportUrl?: string;
  verifiedBy?: string;
  verifiedAt?: Date;

  createdAt: Date;
}

// ════════════════════════════════════════════════════════════════════════════════
// CROP-SPECIFIC THRESHOLDS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Cold chain thresholds by crop type
 *
 * Based on USDA/FDA and EU export requirements
 */
export const COLD_CHAIN_THRESHOLDS: Record<
  CropType,
  {
    minTemp: number;
    maxTemp: number;
    targetHumidity: number;
    humidityTolerance: number;
    maxTransitHours: number;
    brixMin: number;
    brixMax: number;
    brixPremium: number;
    phMin: number;
    phMax: number;
    shelfLifeDays: number;
  }
> = {
  [CropType.AVOCADO]: {
    minTemp: 5,
    maxTemp: 7,
    targetHumidity: 85,
    humidityTolerance: 5,
    maxTransitHours: 72,
    brixMin: 6,
    brixMax: 8,
    brixPremium: 7.5,
    phMin: 6.0,
    phMax: 6.5,
    shelfLifeDays: 14,
  },
  [CropType.BLUEBERRY]: {
    minTemp: 0,
    maxTemp: 4,
    targetHumidity: 90,
    humidityTolerance: 5,
    maxTransitHours: 48,
    brixMin: 10,
    brixMax: 15,
    brixPremium: 13,
    phMin: 3.0,
    phMax: 4.0,
    shelfLifeDays: 10,
  },
  [CropType.STRAWBERRY]: {
    minTemp: 0,
    maxTemp: 2,
    targetHumidity: 90,
    humidityTolerance: 5,
    maxTransitHours: 36,
    brixMin: 7,
    brixMax: 12,
    brixPremium: 10,
    phMin: 3.0,
    phMax: 3.5,
    shelfLifeDays: 7,
  },
  [CropType.RASPBERRY]: {
    minTemp: 0,
    maxTemp: 2,
    targetHumidity: 90,
    humidityTolerance: 5,
    maxTransitHours: 24,
    brixMin: 8,
    brixMax: 14,
    brixPremium: 11,
    phMin: 2.9,
    phMax: 3.5,
    shelfLifeDays: 3,
  },
  [CropType.COFFEE]: {
    minTemp: 15,
    maxTemp: 25,
    targetHumidity: 60,
    humidityTolerance: 10,
    maxTransitHours: 240,
    brixMin: 18,
    brixMax: 22,
    brixPremium: 20,
    phMin: 4.5,
    phMax: 5.5,
    shelfLifeDays: 365,
  },
  [CropType.CACAO]: {
    minTemp: 15,
    maxTemp: 20,
    targetHumidity: 65,
    humidityTolerance: 10,
    maxTransitHours: 168,
    brixMin: 12,
    brixMax: 16,
    brixPremium: 14,
    phMin: 5.0,
    phMax: 6.0,
    shelfLifeDays: 180,
  },
};

// ════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Calculate compliance score from readings
 */
export function calculateComplianceScore(
  totalReadings: number,
  compliantReadings: number,
  breachCount: number,
  maxBreachDuration: number,
): number {
  if (totalReadings === 0) return 0;

  // Base score from compliant readings (0-80 points)
  const baseScore = (compliantReadings / totalReadings) * 80;

  // Penalty for breaches (up to -15 points)
  const breachPenalty = Math.min(breachCount * 3, 15);

  // Penalty for breach duration (up to -5 points)
  const durationPenalty = Math.min(maxBreachDuration / 60, 5);

  const finalScore = Math.max(
    0,
    baseScore + 20 - breachPenalty - durationPenalty,
  );

  return Math.round(finalScore * 100) / 100;
}

/**
 * Determine quality grade from Brix and pH
 */
export function calculateQualityGrade(
  cropType: CropType,
  brixLevel: number,
  phLevel?: number | null,
): QualityGradeType {
  const thresholds = COLD_CHAIN_THRESHOLDS[cropType];

  // Check Brix compliance
  const brixInRange =
    brixLevel >= thresholds.brixMin && brixLevel <= thresholds.brixMax;
  const brixPremium = brixLevel >= thresholds.brixPremium;

  // Check pH if provided
  let phInRange = true;
  if (phLevel !== null && phLevel !== undefined) {
    phInRange = phLevel >= thresholds.phMin && phLevel <= thresholds.phMax;
  }

  // Grade logic
  if (brixPremium && phInRange) return QualityGradeType.PREMIUM;
  if (brixInRange && phInRange) return QualityGradeType.EXPORT;
  if (brixInRange) return QualityGradeType.DOMESTIC;
  return QualityGradeType.REJECT;
}

/**
 * Determine breach severity from deviation and duration
 */
export function calculateBreachSeverity(
  deviation: number,
  durationMinutes: number,
): BreachSeverity {
  // Critical: >5°C deviation OR >60 min
  if (deviation > 5 || durationMinutes > 60) return BreachSeverity.CRITICAL;

  // High: 3-5°C deviation AND/OR 30-60 min
  if (deviation > 3 || durationMinutes > 30) return BreachSeverity.HIGH;

  // Medium: 1-3°C deviation AND/OR 10-30 min
  if (deviation > 1 || durationMinutes > 10) return BreachSeverity.MEDIUM;

  // Low: <1°C deviation AND <10 min
  return BreachSeverity.LOW;
}

/**
 * Check if temperature is in range for crop type
 */
export function isTemperatureCompliant(
  cropType: CropType,
  temperature: number,
): boolean {
  const thresholds = COLD_CHAIN_THRESHOLDS[cropType];
  return temperature >= thresholds.minTemp && temperature <= thresholds.maxTemp;
}

/**
 * Check if humidity is in range for crop type
 */
export function isHumidityCompliant(
  cropType: CropType,
  humidity: number,
): boolean {
  const thresholds = COLD_CHAIN_THRESHOLDS[cropType];
  return (
    humidity >= thresholds.targetHumidity - thresholds.humidityTolerance &&
    humidity <= thresholds.targetHumidity + thresholds.humidityTolerance
  );
}

/**
 * Calculate estimated shelf life remaining based on cold chain compliance
 */
export function calculateShelfLife(
  cropType: CropType,
  complianceScore: number,
  hoursInTransit: number,
): number {
  const thresholds = COLD_CHAIN_THRESHOLDS[cropType];
  const baseShelfLife = thresholds.shelfLifeDays;

  // Reduce shelf life based on compliance score
  const complianceFactor = complianceScore / 100;

  // Reduce for time already in transit
  const transitDays = hoursInTransit / 24;

  const remainingDays = Math.max(
    0,
    baseShelfLife * complianceFactor - transitDays,
  );

  return Math.round(remainingDays * 10) / 10;
}

/**
 * Estimate market price based on quality grade
 *
 * Prices in USD/kg for Mexican export market (2024 prices)
 */
export function estimateMarketPrice(
  cropType: CropType,
  qualityGrade: QualityGradeType,
): number {
  const basePrices: Record<CropType, Record<QualityGradeType, number>> = {
    [CropType.AVOCADO]: {
      [QualityGradeType.PREMIUM]: 4.5,
      [QualityGradeType.EXPORT]: 3.2,
      [QualityGradeType.DOMESTIC]: 1.8,
      [QualityGradeType.REJECT]: 0.5,
    },
    [CropType.BLUEBERRY]: {
      [QualityGradeType.PREMIUM]: 12.0,
      [QualityGradeType.EXPORT]: 8.5,
      [QualityGradeType.DOMESTIC]: 5.0,
      [QualityGradeType.REJECT]: 1.5,
    },
    [CropType.STRAWBERRY]: {
      [QualityGradeType.PREMIUM]: 6.0,
      [QualityGradeType.EXPORT]: 4.0,
      [QualityGradeType.DOMESTIC]: 2.5,
      [QualityGradeType.REJECT]: 0.8,
    },
    [CropType.RASPBERRY]: {
      [QualityGradeType.PREMIUM]: 14.0,
      [QualityGradeType.EXPORT]: 10.0,
      [QualityGradeType.DOMESTIC]: 6.0,
      [QualityGradeType.REJECT]: 2.0,
    },
    [CropType.COFFEE]: {
      [QualityGradeType.PREMIUM]: 8.0,
      [QualityGradeType.EXPORT]: 5.5,
      [QualityGradeType.DOMESTIC]: 3.0,
      [QualityGradeType.REJECT]: 1.0,
    },
    [CropType.CACAO]: {
      [QualityGradeType.PREMIUM]: 6.5,
      [QualityGradeType.EXPORT]: 4.5,
      [QualityGradeType.DOMESTIC]: 2.5,
      [QualityGradeType.REJECT]: 0.8,
    },
  };

  return basePrices[cropType][qualityGrade];
}

/**
 * Grade Brix level for a crop
 */
export function gradeBrixLevel(
  cropType: CropType,
  brixLevel: number,
): "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR" {
  const thresholds = COLD_CHAIN_THRESHOLDS[cropType];

  if (brixLevel >= thresholds.brixPremium) return "EXCELLENT";
  if (brixLevel >= thresholds.brixMin && brixLevel <= thresholds.brixMax)
    return "GOOD";
  if (brixLevel >= thresholds.brixMin - 1) return "ACCEPTABLE";
  return "POOR";
}

/**
 * Grade pH level for a crop
 */
export function gradePhLevel(
  cropType: CropType,
  phLevel: number,
): "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR" {
  const thresholds = COLD_CHAIN_THRESHOLDS[cropType];
  const midpoint = (thresholds.phMin + thresholds.phMax) / 2;
  const range = thresholds.phMax - thresholds.phMin;

  // Excellent: within 25% of midpoint
  if (Math.abs(phLevel - midpoint) <= range * 0.25) return "EXCELLENT";

  // Good: within range
  if (phLevel >= thresholds.phMin && phLevel <= thresholds.phMax) return "GOOD";

  // Acceptable: within 10% of range
  if (phLevel >= thresholds.phMin - 0.2 && phLevel <= thresholds.phMax + 0.2)
    return "ACCEPTABLE";

  return "POOR";
}
