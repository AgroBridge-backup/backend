/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Use Case: Update transit session status
 */

import { TransitTrackingService } from '../../../domain/services/TransitTrackingService.js';
import { TransitSession, TransitStatus } from '../../../domain/entities/TransitSession.js';

export interface UpdateTransitStatusRequest {
  sessionId: string;
  status: TransitStatus;
  userId: string;
}

export class UpdateTransitStatusUseCase {
  constructor(private transitService: TransitTrackingService) {}

  async execute(request: UpdateTransitStatusRequest): Promise<TransitSession> {
    return this.transitService.updateSessionStatus(
      request.sessionId,
      request.status,
      request.userId
    );
  }
}
