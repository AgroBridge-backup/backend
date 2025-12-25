export var TemperatureSource;
(function (TemperatureSource) {
    TemperatureSource["IOT_SENSOR"] = "IOT_SENSOR";
    TemperatureSource["MANUAL"] = "MANUAL";
    TemperatureSource["DRIVER_APP"] = "DRIVER_APP";
})(TemperatureSource || (TemperatureSource = {}));
export const TEMPERATURE_SOURCE_INFO = {
    [TemperatureSource.IOT_SENSOR]: {
        displayName: 'Sensor IoT',
        description: 'Lectura automática de sensor conectado',
        icon: 'sensors',
    },
    [TemperatureSource.MANUAL]: {
        displayName: 'Manual',
        description: 'Registro manual por operador',
        icon: 'edit',
    },
    [TemperatureSource.DRIVER_APP]: {
        displayName: 'App Conductor',
        description: 'Registro desde aplicación móvil',
        icon: 'phone_android',
    },
};
export const DEFAULT_THRESHOLDS = {
    BERRIES: { min: 0, max: 4 },
    AVOCADO: { min: 5, max: 12 },
    MANGO: { min: 10, max: 13 },
    CITRUS: { min: 3, max: 8 },
    VEGETABLES: { min: 0, max: 5 },
    DEFAULT: { min: 0, max: 8 },
};
export function isTemperatureInRange(value, minThreshold, maxThreshold) {
    return value >= minThreshold && value <= maxThreshold;
}
export function getAlertSeverity(value, minThreshold, maxThreshold) {
    if (isTemperatureInRange(value, minThreshold, maxThreshold)) {
        return null;
    }
    const deviation = value < minThreshold
        ? minThreshold - value
        : value - maxThreshold;
    return deviation > 5 ? 'CRITICAL' : 'WARNING';
}
export function calculateTemperatureStats(readings) {
    if (readings.length === 0)
        return null;
    const values = readings.map(r => r.value);
    const outOfRange = readings.filter(r => r.isOutOfRange);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const sortedByTime = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return {
        batchId: readings[0].batchId,
        count: readings.length,
        minValue,
        maxValue,
        avgValue: Math.round(avgValue * 100) / 100,
        outOfRangeCount: outOfRange.length,
        outOfRangePercent: Math.round((outOfRange.length / readings.length) * 100),
        firstReading: sortedByTime[0]?.timestamp ?? null,
        lastReading: sortedByTime[sortedByTime.length - 1]?.timestamp ?? null,
        isCompliant: outOfRange.length === 0,
    };
}
export function detectRapidChange(readings, maxChangePerHour = 3) {
    if (readings.length < 2)
        return [];
    const sorted = [...readings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const rapidChanges = [];
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const timeDiffHours = (curr.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 60 * 60);
        if (timeDiffHours === 0)
            continue;
        const tempChange = Math.abs(curr.value - prev.value);
        const changeRate = tempChange / timeDiffHours;
        if (changeRate > maxChangePerHour) {
            rapidChanges.push(curr);
        }
    }
    return rapidChanges;
}
