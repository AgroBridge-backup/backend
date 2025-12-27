// FIX 2025: Barrel file corrected by QA Architect to ensure proper module exports.
export * from "./CreateBatchUseCase.js";
export * from "./GetBatchByIdUseCase.js";
export * from "./GetBatchByNumberUseCase.js";
export * from "./GetBatchHistoryUseCase.js";

import { CreateBatchUseCase } from "./CreateBatchUseCase.js";
import { GetBatchByIdUseCase } from "./GetBatchByIdUseCase.js";
import { GetBatchByNumberUseCase } from "./GetBatchByNumberUseCase.js";
import { GetBatchHistoryUseCase } from "./GetBatchHistoryUseCase.js";

export type BatchUseCases = {
  createBatchUseCase: CreateBatchUseCase;
  getBatchByIdUseCase: GetBatchByIdUseCase;
  getBatchByNumberUseCase: GetBatchByNumberUseCase;
  getBatchHistoryUseCase: GetBatchHistoryUseCase;
};
