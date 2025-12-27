/**
 * Traceability 2.0 - Real-Time Transit Tracking
 * Use Case: Add a GPS location update
 */

import {
  TransitTrackingService,
  LocationUpdateResult,
} from "../../../domain/services/TransitTrackingService.js";
import { AddLocationInput } from "../../../domain/entities/TransitSession.js";

export interface AddLocationUpdateRequest extends AddLocationInput {}

export class AddLocationUpdateUseCase {
  constructor(private transitService: TransitTrackingService) {}

  async execute(
    request: AddLocationUpdateRequest,
  ): Promise<LocationUpdateResult> {
    return this.transitService.addLocationUpdate(request);
  }
}
