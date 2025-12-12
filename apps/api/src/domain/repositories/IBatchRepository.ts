import { Batch } from '../entities/Batch.js';

export interface IBatchRepository {
  countByProducer(producerId: string): Promise<number>;
  create(data: Partial<Batch>): Promise<Batch>;
  update(id: string, data: Partial<Batch>): Promise<Batch>;
  findById(id: string): Promise<Batch | null>;
}
