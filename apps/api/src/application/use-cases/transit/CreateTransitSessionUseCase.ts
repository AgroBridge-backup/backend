/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Use Case: Create a new transit session
 */

import { TransitTrackingService } from '../../../domain/services/TransitTrackingService.js';
import { TransitSession, CreateTransitSessionInput } from '../../../domain/entities/TransitSession.js';

export interface CreateTransitSessionRequest extends CreateTransitSessionInput {}

export class CreateTransitSessionUseCase {
  constructor(private transitService: TransitTrackingService) {}

  async execute(request: CreateTransitSessionRequest): Promise<TransitSession> {
    return this.transitService.createSession(request);
  }
}
