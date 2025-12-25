import { AppError } from '../../../shared/errors/AppError.js';
export class RecordTemperatureUseCase {
    temperatureService;
    constructor(temperatureService) {
        this.temperatureService = temperatureService;
    }
    async execute(input) {
        if (input.value < -50 || input.value > 60) {
            throw new AppError('Temperature value out of reasonable range (-50 to 60°C)', 400);
        }
        if (input.humidity !== undefined && (input.humidity < 0 || input.humidity > 100)) {
            throw new AppError('Humidity must be between 0 and 100%', 400);
        }
        if (input.latitude !== undefined && (input.latitude < -90 || input.latitude > 90)) {
            throw new AppError('Invalid latitude', 400);
        }
        if (input.longitude !== undefined && (input.longitude < -180 || input.longitude > 180)) {
            throw new AppError('Invalid longitude', 400);
        }
        return this.temperatureService.recordTemperature(input);
    }
}
