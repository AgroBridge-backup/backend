/**
 * Traceability 2.0 - Cold Chain Temperature Log
 * Domain Entity for Temperature Readings
 */

export enum TemperatureSource {
  IOT_SENSOR = 'IOT_SENSOR',
  MANUAL = 'MANUAL',
  DRIVER_APP = 'DRIVER_APP',
}

export interface TemperatureReading {
  id: string;
  batchId: string;
  value: number; // Celsius
  humidity: number | null; // Percentage
  source: TemperatureSource;
  minThreshold: number;
  maxThreshold: number;
  isOutOfRange: boolean;
  sensorId: string | null;
  deviceId: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedBy: string | null;
  timestamp: Date;
}

export interface CreateTemperatureReadingInput {
  batchId: string;
  value: number;
  humidity?: number;
  source: TemperatureSource;
  minThreshold?: number;
  maxThreshold?: number;
  sensorId?: string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
  recordedBy?: string;
}

export interface TemperatureSummary {
  batchId: string;
  count: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
  outOfRangeCount: number;
  outOfRangePercent: number;
  firstReading: Date | null;
  lastReading: Date | null;
  isCompliant: boolean;
}

export interface TemperatureAlert {
  id: string;
  readingId: string;
  batchId: string;
  type: 'HIGH_TEMP' | 'LOW_TEMP' | 'SENSOR_OFFLINE' | 'RAPID_CHANGE';
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
}

/**
 * Temperature source display information
 */
export const TEMPERATURE_SOURCE_INFO: Record<TemperatureSource, {
  displayName: string;
  description: string;
  icon: string;
}> = {
  [TemperatureSource.IOT_SENSOR]: {
    displayName: 'Sensor IoT',
    description: 'Lectura automática de sensor conectado',
    icon: 'sensors',
  },
  [TemperatureSource.MANUAL]: {
    displayName: 'Manual',
    description: 'Registro manual por operador',
    icon: 'edit',
  },
  [TemperatureSource.DRIVER_APP]: {
    displayName: 'App Conductor',
    description: 'Registro desde aplicación móvil',
    icon: 'phone_android',
  },
};

/**
 * Default temperature thresholds by product type
 */
export const DEFAULT_THRESHOLDS: Record<string, { min: number; max: number }> = {
  BERRIES: { min: 0, max: 4 },
  AVOCADO: { min: 5, max: 12 },
  MANGO: { min: 10, max: 13 },
  CITRUS: { min: 3, max: 8 },
  VEGETABLES: { min: 0, max: 5 },
  DEFAULT: { min: 0, max: 8 },
};

/**
 * Check if a temperature reading is within acceptable range
 */
export function isTemperatureInRange(
  value: number,
  minThreshold: number,
  maxThreshold: number
): boolean {
  return value >= minThreshold && value <= maxThreshold;
}

/**
 * Determine alert severity based on deviation
 */
export function getAlertSeverity(
  value: number,
  minThreshold: number,
  maxThreshold: number
): 'WARNING' | 'CRITICAL' | null {
  if (isTemperatureInRange(value, minThreshold, maxThreshold)) {
    return null;
  }

  const deviation = value < minThreshold
    ? minThreshold - value
    : value - maxThreshold;

  // Critical if deviation > 5°C
  return deviation > 5 ? 'CRITICAL' : 'WARNING';
}

/**
 * Calculate temperature statistics from readings
 */
export function calculateTemperatureStats(readings: TemperatureReading[]): TemperatureSummary | null {
  if (readings.length === 0) return null;

  const values = readings.map(r => r.value);
  const outOfRange = readings.filter(r => r.isOutOfRange);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

  const sortedByTime = [...readings].sort((a, b) =>
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  return {
    batchId: readings[0].batchId,
    count: readings.length,
    minValue,
    maxValue,
    avgValue: Math.round(avgValue * 100) / 100,
    outOfRangeCount: outOfRange.length,
    outOfRangePercent: Math.round((outOfRange.length / readings.length) * 100),
    firstReading: sortedByTime[0]?.timestamp ?? null,
    lastReading: sortedByTime[sortedByTime.length - 1]?.timestamp ?? null,
    isCompliant: outOfRange.length === 0,
  };
}

/**
 * Detect rapid temperature changes (potential cold chain breach)
 */
export function detectRapidChange(
  readings: TemperatureReading[],
  maxChangePerHour: number = 3 // °C per hour
): TemperatureReading[] {
  if (readings.length < 2) return [];

  const sorted = [...readings].sort((a, b) =>
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  const rapidChanges: TemperatureReading[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const timeDiffHours = (curr.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 60 * 60);
    if (timeDiffHours === 0) continue;

    const tempChange = Math.abs(curr.value - prev.value);
    const changeRate = tempChange / timeDiffHours;

    if (changeRate > maxChangePerHour) {
      rapidChanges.push(curr);
    }
  }

  return rapidChanges;
}
