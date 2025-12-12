import { Router } from 'express';
import { RegisterEventUseCase } from '@/application/use-cases/events/RegisterEventUseCase';
import { GetEventByIdUseCase } from '@/application/use-cases/events/GetEventByIdUseCase';
import { GetBatchHistoryUseCase } from '@/application/use-cases/batches/GetBatchHistoryUseCase';
export declare function createEventsRouter(useCases: {
    registerEventUseCase: RegisterEventUseCase;
    getEventByIdUseCase: GetEventByIdUseCase;
    getBatchHistoryUseCase: GetBatchHistoryUseCase;
}): Router;
//# sourceMappingURL=events.routes.d.ts.map