import { Producer } from '@/domain/entities/Producer';
export interface IProducerRepository {
    findById(id: string): Promise<(Producer & {
        user: {
            walletAddress: string | null;
        };
    }) | null>;
}
//# sourceMappingURL=IProducerRepository.d.ts.map