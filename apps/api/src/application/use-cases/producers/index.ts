// FIX 2025: Barrel file corrected by QA Architect to ensure proper module exports.
export * from './ListProducersUseCase.js';
export * from './GetProducerByIdUseCase.js';
export * from './WhitelistProducerUseCase.js';
export * from './AddCertificationUseCase.js';

import { ListProducersUseCase } from './ListProducersUseCase.js';
import { GetProducerByIdUseCase } from './GetProducerByIdUseCase.js';
import { WhitelistProducerUseCase } from './WhitelistProducerUseCase.js';
import { AddCertificationUseCase } from './AddCertificationUseCase.js';

export type ProducerUseCases = {
  listProducersUseCase: ListProducersUseCase;
  getProducerByIdUseCase: GetProducerByIdUseCase;
  whitelistProducerUseCase: WhitelistProducerUseCase;
  addCertificationUseCase: AddCertificationUseCase;
};