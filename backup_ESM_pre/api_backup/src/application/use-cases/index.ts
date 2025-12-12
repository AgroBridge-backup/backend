// This file centralizes the types for all use cases for dependency injection.

import { LoginUseCase } from './auth/LoginUseCase.js';
import { RefreshTokenUseCase } from './auth/RefreshTokenUseCase.js';
import { LogoutUseCase } from './auth/LogoutUseCase.js';
import { GetCurrentUserUseCase } from './auth/GetCurrentUserUseCase.js';
import { CreateBatchUseCase } from './batches/CreateBatchUseCase.js';
import { GetBatchByNumberUseCase } from './batches/GetBatchByNumberUseCase.js';
import { GetBatchHistoryUseCase } from './batches/GetBatchHistoryUseCase.js';
import { RegisterEventUseCase } from './events/RegisterEventUseCase.js';
import { GetEventByIdUseCase } from './events/GetEventByIdUseCase.js';
import { ListProducersUseCase } from './producers/ListProducersUseCase.js';
import { GetProducerByIdUseCase } from './producers/GetProducerByIdUseCase.js';
import { WhitelistProducerUseCase } from './producers/WhitelistProducerUseCase.js';
import { AddCertificationUseCase } from './producers/AddCertificationUseCase.js';

export interface AllUseCases {
  auth: {
    loginUseCase: LoginUseCase;
    refreshTokenUseCase: RefreshTokenUseCase;
    logoutUseCase: LogoutUseCase;
    getCurrentUserUseCase: GetCurrentUserUseCase;
  };
  batches: {
    createBatchUseCase: CreateBatchUseCase;
    getBatchByNumberUseCase: GetBatchByNumberUseCase;
    getBatchHistoryUseCase: GetBatchHistoryUseCase;
  };
  events: {
    registerEventUseCase: RegisterEventUseCase;
    getEventByIdUseCase: GetEventByIdUseCase;
    getBatchHistoryUseCase: GetBatchHistoryUseCase;
  };
  producers: {
    listProducersUseCase: ListProducersUseCase;
    getProducerByIdUseCase: GetProducerByIdUseCase;
    whitelistProducerUseCase: WhitelistProducerUseCase;
    addCertificationUseCase: AddCertificationUseCase;
  };
}
