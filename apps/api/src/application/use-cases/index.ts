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

// Traceability 2.0 - Verification Stages
import { GetBatchStagesUseCase } from './verification-stages/GetBatchStagesUseCase.js';
import { CreateBatchStageUseCase } from './verification-stages/CreateBatchStageUseCase.js';
import { UpdateBatchStageUseCase } from './verification-stages/UpdateBatchStageUseCase.js';
import { FinalizeBatchStagesUseCase } from './verification-stages/FinalizeBatchStagesUseCase.js';

// Traceability 2.0 - Quality Certificates
import { IssueCertificateUseCase } from './certificates/IssueCertificateUseCase.js';
import { GetCertificateUseCase } from './certificates/GetCertificateUseCase.js';
import { ListBatchCertificatesUseCase } from './certificates/ListBatchCertificatesUseCase.js';
import { VerifyCertificateUseCase } from './certificates/VerifyCertificateUseCase.js';
import { CheckCertificateEligibilityUseCase } from './certificates/CheckCertificateEligibilityUseCase.js';

// Traceability 2.0 - Real-Time Transit Tracking
import { CreateTransitSessionUseCase } from './transit/CreateTransitSessionUseCase.js';
import { GetTransitSessionUseCase } from './transit/GetTransitSessionUseCase.js';
import { UpdateTransitStatusUseCase } from './transit/UpdateTransitStatusUseCase.js';
import { AddLocationUpdateUseCase } from './transit/AddLocationUpdateUseCase.js';
import { GetLocationHistoryUseCase } from './transit/GetLocationHistoryUseCase.js';
import { TransitTrackingService } from '../../domain/services/TransitTrackingService.js';

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
  // Traceability 2.0 - Verification Stages
  verificationStages: {
    getBatchStagesUseCase: GetBatchStagesUseCase;
    createBatchStageUseCase: CreateBatchStageUseCase;
    updateBatchStageUseCase: UpdateBatchStageUseCase;
    finalizeBatchStagesUseCase?: FinalizeBatchStagesUseCase;
  };
  // Traceability 2.0 - Quality Certificates
  certificates: {
    issueCertificateUseCase: IssueCertificateUseCase;
    getCertificateUseCase: GetCertificateUseCase;
    listBatchCertificatesUseCase: ListBatchCertificatesUseCase;
    verifyCertificateUseCase: VerifyCertificateUseCase;
    checkCertificateEligibilityUseCase: CheckCertificateEligibilityUseCase;
  };
  // Traceability 2.0 - Real-Time Transit Tracking
  transit: {
    createTransitSessionUseCase: CreateTransitSessionUseCase;
    getTransitSessionUseCase: GetTransitSessionUseCase;
    updateTransitStatusUseCase: UpdateTransitStatusUseCase;
    addLocationUpdateUseCase: AddLocationUpdateUseCase;
    getLocationHistoryUseCase: GetLocationHistoryUseCase;
    transitService: TransitTrackingService;
  };
}
