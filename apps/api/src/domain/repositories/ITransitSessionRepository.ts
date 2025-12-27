/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Repository Interface for TransitSession
 */

import {
  TransitSession,
  TransitLocation,
  TransitStatus,
  CreateTransitSessionInput,
  AddLocationInput,
} from "../entities/TransitSession.js";

export interface ITransitSessionRepository {
  /**
   * Find a transit session by ID
   */
  findById(id: string): Promise<TransitSession | null>;

  /**
   * Find a transit session by ID with locations
   */
  findByIdWithLocations(id: string): Promise<TransitSession | null>;

  /**
   * Find all transit sessions for a batch
   */
  findByBatchId(batchId: string): Promise<TransitSession[]>;

  /**
   * Find active transit sessions for a driver
   */
  findActiveByDriverId(driverId: string): Promise<TransitSession[]>;

  /**
   * Find sessions by status
   */
  findByStatus(status: TransitStatus): Promise<TransitSession[]>;

  /**
   * Create a new transit session
   */
  create(input: CreateTransitSessionInput): Promise<TransitSession>;

  /**
   * Update transit session status
   */
  updateStatus(
    id: string,
    status: TransitStatus,
    updates?: {
      actualDeparture?: Date;
      actualArrival?: Date;
      estimatedArrival?: Date;
    },
  ): Promise<TransitSession>;

  /**
   * Update estimated arrival time
   */
  updateEstimatedArrival(
    id: string,
    estimatedArrival: Date,
  ): Promise<TransitSession>;

  /**
   * Update distance traveled
   */
  updateDistanceTraveled(
    id: string,
    distanceTraveledKm: number,
  ): Promise<TransitSession>;

  /**
   * Add a location update to a session
   */
  addLocation(input: AddLocationInput): Promise<TransitLocation>;

  /**
   * Get locations for a session
   */
  getLocations(sessionId: string, limit?: number): Promise<TransitLocation[]>;

  /**
   * Get the latest location for a session
   */
  getLatestLocation(sessionId: string): Promise<TransitLocation | null>;

  /**
   * Count locations for a session
   */
  countLocations(sessionId: string): Promise<number>;

  /**
   * Get off-route locations for a session
   */
  getOffRouteLocations(sessionId: string): Promise<TransitLocation[]>;
}
