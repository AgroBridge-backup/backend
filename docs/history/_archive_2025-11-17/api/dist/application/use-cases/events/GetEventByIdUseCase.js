export class GetEventByIdUseCase {
    async execute(dto) {
        console.log(dto);
        return { eventId: dto.eventId, eventType: 'HARVEST' };
    }
}
//# sourceMappingURL=GetEventByIdUseCase.js.map