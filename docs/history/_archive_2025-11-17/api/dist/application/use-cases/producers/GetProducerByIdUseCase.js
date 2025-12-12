export class GetProducerByIdUseCase {
    async execute(dto) {
        console.log(dto);
        return { id: dto.producerId, businessName: 'Mock Producer' };
    }
}
//# sourceMappingURL=GetProducerByIdUseCase.js.map