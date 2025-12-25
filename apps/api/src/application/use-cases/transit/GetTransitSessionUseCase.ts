/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Use Case: Get transit session details
 */

import { TransitTrackingService, TransitSessionWithProgress } from '../../../domain/services/TransitTrackingService.js';
import { AppError } from '../../../shared/errors/AppError.js';

export interface GetTransitSessionRequest {
  sessionId: string;
}

export class GetTransitSessionUseCase {
  constructor(private transitService: TransitTrackingService) {}

  async execute(request: GetTransitSessionRequest): Promise<TransitSessionWithProgress> {
    const session = await this.transitService.getSessionWithProgress(request.sessionId);

    if (!session) {
      throw new AppError('Transit session not found', 404);
    }

    return session;
  }
}
