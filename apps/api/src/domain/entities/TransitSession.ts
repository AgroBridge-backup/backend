/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Domain Entity for Transit Sessions and Locations
 */

export enum TransitStatus {
  SCHEDULED = 'SCHEDULED',
  IN_TRANSIT = 'IN_TRANSIT',
  PAUSED = 'PAUSED',
  DELAYED = 'DELAYED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface TransitSession {
  id: string;
  batchId: string;
  status: TransitStatus;
  driverId: string;
  vehicleId: string | null;

  // Route information
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;

  // Timing
  scheduledDeparture: Date | null;
  actualDeparture: Date | null;
  scheduledArrival: Date | null;
  actualArrival: Date | null;
  estimatedArrival: Date | null;

  // Distance tracking
  totalDistanceKm: number | null;
  distanceTraveledKm: number | null;

  // Geofence settings
  maxDeviationKm: number;
  alertOnDeviation: boolean;

  // Relations
  locations?: TransitLocation[];

  createdAt: Date;
  updatedAt: Date;
}

export interface TransitLocation {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  address: string | null;
  isOffRoute: boolean;
  deviationKm: number | null;
  timestamp: Date;
}

export interface CreateTransitSessionInput {
  batchId: string;
  driverId: string;
  vehicleId?: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  scheduledDeparture?: Date;
  scheduledArrival?: Date;
  totalDistanceKm?: number;
  maxDeviationKm?: number;
  alertOnDeviation?: boolean;
}

export interface AddLocationInput {
  sessionId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  address?: string;
}

export interface UpdateTransitStatusInput {
  sessionId: string;
  status: TransitStatus;
  actualDeparture?: Date;
  actualArrival?: Date;
  estimatedArrival?: Date;
}

/**
 * Status display information
 */
export const TRANSIT_STATUS_INFO: Record<TransitStatus, {
  displayName: string;
  description: string;
  color: string;
  icon: string;
}> = {
  [TransitStatus.SCHEDULED]: {
    displayName: 'Programado',
    description: 'Tránsito programado, pendiente de inicio',
    color: '#9E9E9E',
    icon: 'schedule',
  },
  [TransitStatus.IN_TRANSIT]: {
    displayName: 'En tránsito',
    description: 'Vehículo en movimiento hacia destino',
    color: '#2196F3',
    icon: 'local_shipping',
  },
  [TransitStatus.PAUSED]: {
    displayName: 'Pausado',
    description: 'Tránsito temporalmente detenido',
    color: '#FF9800',
    icon: 'pause_circle',
  },
  [TransitStatus.DELAYED]: {
    displayName: 'Retrasado',
    description: 'Tránsito con retraso sobre horario',
    color: '#F44336',
    icon: 'warning',
  },
  [TransitStatus.COMPLETED]: {
    displayName: 'Completado',
    description: 'Tránsito finalizado exitosamente',
    color: '#4CAF50',
    icon: 'check_circle',
  },
  [TransitStatus.CANCELLED]: {
    displayName: 'Cancelado',
    description: 'Tránsito cancelado',
    color: '#795548',
    icon: 'cancel',
  },
};

/**
 * Valid status transitions for transit sessions
 */
export const VALID_STATUS_TRANSITIONS: Record<TransitStatus, TransitStatus[]> = {
  [TransitStatus.SCHEDULED]: [TransitStatus.IN_TRANSIT, TransitStatus.CANCELLED],
  [TransitStatus.IN_TRANSIT]: [TransitStatus.PAUSED, TransitStatus.DELAYED, TransitStatus.COMPLETED],
  [TransitStatus.PAUSED]: [TransitStatus.IN_TRANSIT, TransitStatus.CANCELLED],
  [TransitStatus.DELAYED]: [TransitStatus.IN_TRANSIT, TransitStatus.COMPLETED, TransitStatus.CANCELLED],
  [TransitStatus.COMPLETED]: [], // Terminal state
  [TransitStatus.CANCELLED]: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(from: TransitStatus, to: TransitStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a location is off the route (simple straight-line deviation check)
 * For production, this should use actual route polyline
 */
export function calculateRouteDeviation(
  currentLat: number,
  currentLng: number,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): number {
  // Calculate perpendicular distance from point to line (origin to destination)
  const A = currentLat - originLat;
  const B = currentLng - originLng;
  const C = destLat - originLat;
  const D = destLng - originLng;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let nearestLat: number;
  let nearestLng: number;

  if (param < 0) {
    nearestLat = originLat;
    nearestLng = originLng;
  } else if (param > 1) {
    nearestLat = destLat;
    nearestLng = destLng;
  } else {
    nearestLat = originLat + param * C;
    nearestLng = originLng + param * D;
  }

  return calculateDistance(currentLat, currentLng, nearestLat, nearestLng);
}

/**
 * Calculate progress percentage based on distance traveled
 */
export function calculateProgress(distanceTraveled: number, totalDistance: number): number {
  if (totalDistance <= 0) return 0;
  return Math.min(100, Math.round((distanceTraveled / totalDistance) * 100));
}

/**
 * Estimate arrival time based on current speed and remaining distance
 */
export function estimateArrival(
  remainingDistanceKm: number,
  currentSpeedKmh: number
): Date | null {
  if (currentSpeedKmh <= 0 || remainingDistanceKm <= 0) return null;

  const hoursRemaining = remainingDistanceKm / currentSpeedKmh;
  const msRemaining = hoursRemaining * 60 * 60 * 1000;

  return new Date(Date.now() + msRemaining);
}
