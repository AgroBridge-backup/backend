import { AppError } from '../../../shared/errors/AppError.js';
export class GetLatestTemperatureUseCase {
    prisma;
    temperatureService;
    constructor(prisma, temperatureService) {
        this.prisma = prisma;
        this.temperatureService = temperatureService;
    }
    async execute(input) {
        const batch = await this.prisma.batch.findUnique({
            where: { id: input.batchId },
        });
        if (!batch) {
            throw new AppError('Batch not found', 404);
        }
        return this.temperatureService.getLatestReading(input.batchId);
    }
}
