import { AppError } from '../../../shared/errors/AppError.js';
export class GetTemperatureReadingsUseCase {
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
        let readings;
        let chartData;
        if (input.startTime && input.endTime) {
            chartData = await this.temperatureService.getChartData(input.batchId, input.startTime, input.endTime);
            readings = await this.temperatureService.getReadings(input.batchId, input.limit);
        }
        else {
            readings = await this.temperatureService.getReadings(input.batchId, input.limit);
        }
        return { readings, chartData };
    }
}
