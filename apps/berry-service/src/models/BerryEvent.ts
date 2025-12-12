// Definición del modelo de evento, alineado con el schema de Prisma.
export interface BerryEvent {
  id: string;
  batchId: string;
  eventType: string;
  eventData: any;
  occurredAt: Date;
  sequenceNumber: number;
}
