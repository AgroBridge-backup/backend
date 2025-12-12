import { TraceabilityEvent } from '@/domain/value-objects/TraceabilityEvent';

export interface IEventRepository {
  create(data: Partial<TraceabilityEvent>): Promise<TraceabilityEvent>;
}
