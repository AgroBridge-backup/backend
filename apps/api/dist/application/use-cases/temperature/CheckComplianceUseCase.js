import { AppError } from '../../../shared/errors/AppError.js';
export class CheckComplianceUseCase {
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
        const result = await this.temperatureService.checkCompliance(input.batchId);
        let complianceScore = 100;
        const recommendations = [];
        if (result.summary) {
            const outOfRangePercent = result.summary.outOfRangePercent;
            complianceScore -= outOfRangePercent;
            const rapidChangeCount = result.rapidChanges.length;
            complianceScore -= rapidChangeCount * 5;
            complianceScore = Math.max(0, Math.min(100, complianceScore));
            if (outOfRangePercent > 0) {
                recommendations.push(`${outOfRangePercent}% of readings were out of range. Review cold chain equipment.`);
            }
            if (rapidChangeCount > 0) {
                recommendations.push(`${rapidChangeCount} rapid temperature change(s) detected. Check for cold chain breaches.`);
            }
            if (result.summary.maxValue - result.summary.minValue > 10) {
                recommendations.push('High temperature variance detected. Consider improving insulation or cooling capacity.');
            }
            if (complianceScore < 80) {
                recommendations.push('Compliance score is below acceptable threshold. Immediate corrective action required.');
            }
        }
        else {
            recommendations.push('No temperature readings recorded. Start monitoring to ensure compliance.');
        }
        return {
            isCompliant: result.isCompliant,
            summary: result.summary,
            violations: result.violations,
            rapidChanges: result.rapidChanges,
            complianceScore,
            recommendations,
        };
    }
}
