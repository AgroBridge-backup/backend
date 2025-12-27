/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Use Case: Get location history for a session
 */

import { TransitTrackingService } from "../../../domain/services/TransitTrackingService.js";
import { TransitLocation } from "../../../domain/entities/TransitSession.js";

export interface GetLocationHistoryRequest {
  sessionId: string;
  limit?: number;
}

export class GetLocationHistoryUseCase {
  constructor(private transitService: TransitTrackingService) {}

  async execute(
    request: GetLocationHistoryRequest,
  ): Promise<TransitLocation[]> {
    return this.transitService.getLocationHistory(
      request.sessionId,
      request.limit,
    );
  }
}
