import { Router } from 'express';
import { CreateBatchUseCase } from '@/application/use-cases/batches/CreateBatchUseCase';
import { GetBatchByNumberUseCase } from '@/application/use-cases/batches/GetBatchByNumberUseCase';
import { GetBatchHistoryUseCase } from '@/application/use-cases/batches/GetBatchHistoryUseCase';
export declare function createBatchesRouter(useCases: {
    createBatchUseCase: CreateBatchUseCase;
    getBatchByNumberUseCase: GetBatchByNumberUseCase;
    getBatchHistoryUseCase: GetBatchHistoryUseCase;
}): Router;
//# sourceMappingURL=batches.routes.d.ts.map