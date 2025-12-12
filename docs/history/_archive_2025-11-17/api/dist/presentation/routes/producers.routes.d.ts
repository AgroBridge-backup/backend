import { Router } from 'express';
import { ListProducersUseCase } from '@/application/use-cases/producers/ListProducersUseCase';
import { GetProducerByIdUseCase } from '@/application/use-cases/producers/GetProducerByIdUseCase';
import { WhitelistProducerUseCase } from '@/application/use-cases/producers/WhitelistProducerUseCase';
import { AddCertificationUseCase } from '@/application/use-cases/producers/AddCertificationUseCase';
export declare function createProducersRouter(useCases: {
    listProducersUseCase: ListProducersUseCase;
    getProducerByIdUseCase: GetProducerByIdUseCase;
    whitelistProducerUseCase: WhitelistProducerUseCase;
    addCertificationUseCase: AddCertificationUseCase;
}): Router;
//# sourceMappingURL=producers.routes.d.ts.map