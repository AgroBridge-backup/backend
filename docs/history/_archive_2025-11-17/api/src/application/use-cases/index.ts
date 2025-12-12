// This file centralizes the types for all use cases for dependency injection.

import { LoginUseCase } from './auth/LoginUseCase';
import { RefreshTokenUseCase } from './auth/RefreshTokenUseCase';
import { LogoutUseCase } from './auth/LogoutUseCase';
import { GetCurrentUserUseCase } from './auth/GetCurrentUserUseCase';
import { CreateBatchUseCase } from './batches/CreateBatchUseCase';
import { GetBatchByNumberUseCase } from './batches/GetBatchByNumberUseCase';
import { GetBatchHistoryUseCase } from './batches/GetBatchHistoryUseCase';
import { RegisterEventUseCase } from './events/RegisterEventUseCase';
import { GetEventByIdUseCase } from './events/GetEventByIdUseCase';
import { ListProducersUseCase } from './producers/ListProducersUseCase';
import { GetProducerByIdUseCase } from './producers/GetProducerByIdUseCase';
import { WhitelistProducerUseCase } from './producers/WhitelistProducerUseCase';
import { AddCertificationUseCase } from './producers/AddCertificationUseCase';

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
