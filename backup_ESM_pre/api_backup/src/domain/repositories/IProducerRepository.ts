import { Producer } from '../entities/Producer.js';

export type ProducerList = {
  producers: Producer[];
  total: number;
};

export type FindProducersCriteria = {
  page: number;
  limit: number;
  isWhitelisted?: boolean;
  state?: string;
};

export interface IProducerRepository {
  findById(id: string): Promise<(Producer & { user: { walletAddress: string | null } }) | null>;
  find(criteria: FindProducersCriteria): Promise<ProducerList>;
}
