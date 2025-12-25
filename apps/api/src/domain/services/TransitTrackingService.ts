/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Domain Service for Transit Session Management
 */

import { PrismaClient } from '@prisma/client';
import { ITransitSessionRepository } from '../repositories/ITransitSessionRepository.js';
import {
  TransitSession,
  TransitLocation,
  TransitStatus,
  CreateTransitSessionInput,
  AddLocationInput,
  isValidStatusTransition,
  calculateDistance,
  calculateRouteDeviation,
  estimateArrival,
  calculateProgress,
} from '../entities/TransitSession.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';
import { instrumentAsync, addBreadcrumb, setContext } from '../../infrastructure/monitoring/sentry.js';

export interface TransitSessionWithProgress extends TransitSession {
  progressPercent: number;
  remainingDistanceKm: number | null;
  lastLocation: TransitLocation | null;
  locationCount: number;
}

export interface LocationUpdateResult {
  location: TransitLocation;
  isOffRoute: boolean;
  deviationKm: number;
  distanceTraveledKm: number;
  estimatedArrival: Date | null;
  alert?: {
    type: 'ROUTE_DEVIATION' | 'EXCESSIVE_SPEED' | 'STOPPED';
    message: string;
  };
}

export class TransitTrackingService {
  constructor(
    private prisma: PrismaClient,
    private sessionRepository: ITransitSessionRepository
  ) {}

  /**
   * Create a new transit session
   */
  async createSession(input: CreateTransitSessionInput): Promise<TransitSession> {
    addBreadcrumb('Creating transit session', 'transit', { batchId: input.batchId });
    setContext('transit', { batchId: input.batchId, driverId: input.driverId });

    return instrumentAsync('createSession', 'transit.create', async () => {
      // Validate batch exists
      const batch = await this.prisma.batch.findUnique({
        where: { id: input.batchId },
      });

      if (!batch) {
        throw new AppError('Batch not found', 404);
      }

      // Check for existing active sessions for this batch
      const existingSessions = await this.sessionRepository.findByBatchId(input.batchId);
      const activeSession = existingSessions.find(s =>
        [TransitStatus.SCHEDULED, TransitStatus.IN_TRANSIT, TransitStatus.PAUSED, TransitStatus.DELAYED].includes(s.status)
      );

      if (activeSession) {
        throw new AppError('Batch already has an active transit session', 400);
      }

      const session = await this.sessionRepository.create(input);

      logger.info('Transit session created', {
        sessionId: session.id,
        batchId: input.batchId,
        driverId: input.driverId,
        origin: input.originName,
        destination: input.destinationName,
      });

      return session;
    });
  }

  /**
   * Get transit session by ID
   */
  async getSession(sessionId: string): Promise<TransitSession | null> {
    return this.sessionRepository.findById(sessionId);
  }

  /**
   * Get transit session with full details and progress
   */
  async getSessionWithProgress(sessionId: string): Promise<TransitSessionWithProgress | null> {
    const session = await this.sessionRepository.findByIdWithLocations(sessionId);

    if (!session) return null;

    const lastLocation = await this.sessionRepository.getLatestLocation(sessionId);
    const locationCount = await this.sessionRepository.countLocations(sessionId);

    const progressPercent = session.totalDistanceKm && session.distanceTraveledKm
      ? calculateProgress(session.distanceTraveledKm, session.totalDistanceKm)
      : 0;

    const remainingDistanceKm = session.totalDistanceKm && session.distanceTraveledKm
      ? session.totalDistanceKm - session.distanceTraveledKm
      : null;

    return {
      ...session,
      progressPercent,
      remainingDistanceKm,
      lastLocation,
      locationCount,
    };
  }

  /**
   * Get all sessions for a batch
   */
  async getBatchSessions(batchId: string): Promise<TransitSession[]> {
    return this.sessionRepository.findByBatchId(batchId);
  }

  /**
   * Get active sessions for a driver
   */
  async getDriverActiveSessions(driverId: string): Promise<TransitSession[]> {
    return this.sessionRepository.findActiveByDriverId(driverId);
  }

  /**
   * Update session status with validation
   */
  async updateSessionStatus(
    sessionId: string,
    newStatus: TransitStatus,
    userId: string
  ): Promise<TransitSession> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError('Transit session not found', 404);
    }

    if (!isValidStatusTransition(session.status, newStatus)) {
      throw new AppError(
        `Cannot transition from ${session.status} to ${newStatus}`,
        400
      );
    }

    const updates: { actualDeparture?: Date; actualArrival?: Date } = {};

    // Set timestamps based on status transition
    if (newStatus === TransitStatus.IN_TRANSIT && !session.actualDeparture) {
      updates.actualDeparture = new Date();
    }

    if (newStatus === TransitStatus.COMPLETED) {
      updates.actualArrival = new Date();
    }

    const updatedSession = await this.sessionRepository.updateStatus(sessionId, newStatus, updates);

    logger.info('Transit session status updated', {
      sessionId,
      previousStatus: session.status,
      newStatus,
      updatedBy: userId,
    });

    return updatedSession;
  }

  /**
   * Start transit (shorthand for updating to IN_TRANSIT)
   */
  async startTransit(sessionId: string, userId: string): Promise<TransitSession> {
    return this.updateSessionStatus(sessionId, TransitStatus.IN_TRANSIT, userId);
  }

  /**
   * Complete transit
   */
  async completeTransit(sessionId: string, userId: string): Promise<TransitSession> {
    return this.updateSessionStatus(sessionId, TransitStatus.COMPLETED, userId);
  }

  /**
   * Add a GPS location update
   */
  async addLocationUpdate(input: AddLocationInput): Promise<LocationUpdateResult> {
    addBreadcrumb('Adding location update', 'transit', { sessionId: input.sessionId });

    return instrumentAsync('addLocationUpdate', 'transit.location', async () => {
      const session = await this.sessionRepository.findById(input.sessionId);

      if (!session) {
        throw new AppError('Transit session not found', 404);
      }

    // Only allow location updates for active sessions
    if (![TransitStatus.IN_TRANSIT, TransitStatus.PAUSED, TransitStatus.DELAYED].includes(session.status)) {
      throw new AppError('Cannot add location to inactive session', 400);
    }

    // Calculate deviation from route
    const deviationKm = calculateRouteDeviation(
      input.latitude,
      input.longitude,
      session.originLat,
      session.originLng,
      session.destinationLat,
      session.destinationLng
    );

    const isOffRoute = deviationKm > session.maxDeviationKm;

    // Calculate cumulative distance traveled
    const lastLocation = await this.sessionRepository.getLatestLocation(input.sessionId);
    let distanceTraveledKm = session.distanceTraveledKm || 0;

    if (lastLocation) {
      const incrementalDistance = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        input.latitude,
        input.longitude
      );
      distanceTraveledKm += incrementalDistance;
    }

    // Create location with deviation info
    const location = await this.prisma.transitLocation.create({
      data: {
        sessionId: input.sessionId,
        latitude: input.latitude,
        longitude: input.longitude,
        altitude: input.altitude,
        accuracy: input.accuracy,
        speed: input.speed,
        heading: input.heading,
        address: input.address,
        isOffRoute,
        deviationKm,
      },
    });

    // Update session with new distance traveled
    await this.sessionRepository.updateDistanceTraveled(input.sessionId, distanceTraveledKm);

    // Calculate new ETA
    let newEstimatedArrival: Date | null = null;
    if (input.speed && session.totalDistanceKm) {
      const remainingDistance = session.totalDistanceKm - distanceTraveledKm;
      newEstimatedArrival = estimateArrival(remainingDistance, input.speed);

      if (newEstimatedArrival) {
        await this.sessionRepository.updateEstimatedArrival(input.sessionId, newEstimatedArrival);
      }
    }

    // Generate alerts if needed
    let alert: LocationUpdateResult['alert'] = undefined;

    if (isOffRoute && session.alertOnDeviation) {
      alert = {
        type: 'ROUTE_DEVIATION',
        message: `Vehicle is ${deviationKm.toFixed(1)}km off route`,
      };

      logger.warn('Transit route deviation detected', {
        sessionId: input.sessionId,
        deviationKm,
        latitude: input.latitude,
        longitude: input.longitude,
      });
    }

    return {
      location: {
        id: location.id,
        sessionId: location.sessionId,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        altitude: location.altitude ? Number(location.altitude) : null,
        accuracy: location.accuracy ? Number(location.accuracy) : null,
        speed: location.speed ? Number(location.speed) : null,
        heading: location.heading ? Number(location.heading) : null,
        address: location.address,
        isOffRoute: location.isOffRoute,
        deviationKm: location.deviationKm ? Number(location.deviationKm) : null,
        timestamp: location.timestamp,
      },
      isOffRoute,
      deviationKm,
      distanceTraveledKm,
      estimatedArrival: newEstimatedArrival,
      alert,
    };
    });
  }

  /**
   * Get location history for a session
   */
  async getLocationHistory(sessionId: string, limit?: number): Promise<TransitLocation[]> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError('Transit session not found', 404);
    }

    return this.sessionRepository.getLocations(sessionId, limit);
  }

  /**
   * Get current location for a session
   */
  async getCurrentLocation(sessionId: string): Promise<TransitLocation | null> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError('Transit session not found', 404);
    }

    return this.sessionRepository.getLatestLocation(sessionId);
  }
}
