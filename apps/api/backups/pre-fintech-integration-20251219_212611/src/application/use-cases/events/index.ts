// FIX 2025: Barrel file corrected by QA Architect to ensure proper module exports.
export * from './RegisterEventUseCase.js';
export * from './GetEventByIdUseCase.js';

import { RegisterEventUseCase } from './RegisterEventUseCase.js';
import { GetEventByIdUseCase } from './GetEventByIdUseCase.js';

export type EventUseCases = {
  registerEventUseCase: RegisterEventUseCase;
  getEventByIdUseCase: GetEventByIdUseCase;
};