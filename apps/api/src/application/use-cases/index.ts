// This file centralizes the types for all use cases for dependency injection.

import { LoginUseCase } from './auth/LoginUseCase.js';
import { RefreshTokenUseCase } from './auth/RefreshTokenUseCase.js';
import { LogoutUseCase } from './auth/LogoutUseCase.js';
import { GetCurrentUserUseCase } from './auth/GetCurrentUserUseCase.js';
import { RegisterUseCase } from './auth/RegisterUseCase.js';
// Two-Factor Authentication Use Cases
import { Setup2FAUseCase } from './auth/Setup2FAUseCase.js';
import { Enable2FAUseCase } from './auth/Enable2FAUseCase.js';
import { Disable2FAUseCase } from './auth/Disable2FAUseCase.js';
import { Verify2FAUseCase } from './auth/Verify2FAUseCase.js';
import { Get2FAStatusUseCase } from './auth/Get2FAStatusUseCase.js';
import { RegenerateBackupCodesUseCase } from './auth/RegenerateBackupCodesUseCase.js';

import { CreateBatchUseCase } from './batches/CreateBatchUseCase.js';
import { GetBatchByNumberUseCase } from './batches/GetBatchByNumberUseCase.js';
import { GetBatchHistoryUseCase } from './batches/GetBatchHistoryUseCase.js';
import { RegisterEventUseCase } from './events/RegisterEventUseCase.js';
import { GetEventByIdUseCase } from './events/GetEventByIdUseCase.js';
import { ListProducersUseCase } from './producers/ListProducersUseCase.js';
import { GetProducerByIdUseCase } from './producers/GetProducerByIdUseCase.js';
import { WhitelistProducerUseCase } from './producers/WhitelistProducerUseCase.js';
import { AddCertificationUseCase } from './producers/AddCertificationUseCase.js';

import { GetBatchByIdUseCase } from './batches/GetBatchByIdUseCase.js';

export interface AllUseCases {
  auth: {
    loginUseCase: LoginUseCase;
    refreshTokenUseCase: RefreshTokenUseCase;
    logoutUseCase: LogoutUseCase;
    getCurrentUserUseCase: GetCurrentUserUseCase;
    registerUseCase: RegisterUseCase;
    // Two-Factor Authentication
    setup2FAUseCase: Setup2FAUseCase;
    enable2FAUseCase: Enable2FAUseCase;
    disable2FAUseCase: Disable2FAUseCase;
    verify2FAUseCase: Verify2FAUseCase;
    get2FAStatusUseCase: Get2FAStatusUseCase;
    regenerateBackupCodesUseCase: RegenerateBackupCodesUseCase;
  };
  batches: {
    createBatchUseCase: CreateBatchUseCase;
    getBatchByNumberUseCase: GetBatchByNumberUseCase;
    getBatchHistoryUseCase: GetBatchHistoryUseCase;
    getBatchByIdUseCase: GetBatchByIdUseCase; // Added
  };
  events: {
    registerEventUseCase: RegisterEventUseCase;
    getEventByIdUseCase: GetEventByIdUseCase;
    // getBatchHistoryUseCase: GetBatchHistoryUseCase; // Removed, belongs in 'batches'
  };
  producers: {
    listProducersUseCase: ListProducersUseCase;
    getProducerByIdUseCase: GetProducerByIdUseCase;
    whitelistProducerUseCase: WhitelistProducerUseCase;
    addCertificationUseCase: AddCertificationUseCase;
  };
}
