import { TraceabilityEvent } from "../value-objects/TraceabilityEvent.js";

export interface IEventRepository {
  create(data: Partial<TraceabilityEvent>): Promise<TraceabilityEvent>;
}
