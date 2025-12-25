import { AppError } from '../../../shared/errors/AppError.js';
export class RecordBatchTemperaturesUseCase {
    temperatureService;
    constructor(temperatureService) {
        this.temperatureService = temperatureService;
    }
    async execute(input) {
        if (!input.readings || input.readings.length === 0) {
            throw new AppError('At least one reading is required', 400);
        }
        if (input.readings.length > 1000) {
            throw new AppError('Maximum 1000 readings per batch insert', 400);
        }
        for (let i = 0; i < input.readings.length; i++) {
            const reading = input.readings[i];
            if (reading.value < -50 || reading.value > 60) {
                throw new AppError(`Reading ${i}: Temperature value out of reasonable range (-50 to 60°C)`, 400);
            }
            if (reading.humidity !== undefined && (reading.humidity < 0 || reading.humidity > 100)) {
                throw new AppError(`Reading ${i}: Humidity must be between 0 and 100%`, 400);
            }
        }
        const readings = input.readings.map(r => ({
            batchId: r.batchId,
            value: r.value,
            humidity: r.humidity,
            source: r.source,
            sensorId: r.sensorId,
            deviceId: r.deviceId,
            latitude: r.latitude,
            longitude: r.longitude,
        }));
        return this.temperatureService.recordBatchTemperatures(readings);
    }
}
