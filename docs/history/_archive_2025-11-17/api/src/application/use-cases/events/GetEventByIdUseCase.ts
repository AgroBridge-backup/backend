export class GetEventByIdUseCase {
  async execute(dto: any): Promise<any> {
    console.log(dto);
    return { eventId: dto.eventId, eventType: 'HARVEST' };
  }
}
