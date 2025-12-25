export var TransitStatus;
(function (TransitStatus) {
    TransitStatus["SCHEDULED"] = "SCHEDULED";
    TransitStatus["IN_TRANSIT"] = "IN_TRANSIT";
    TransitStatus["PAUSED"] = "PAUSED";
    TransitStatus["DELAYED"] = "DELAYED";
    TransitStatus["COMPLETED"] = "COMPLETED";
    TransitStatus["CANCELLED"] = "CANCELLED";
})(TransitStatus || (TransitStatus = {}));
export const TRANSIT_STATUS_INFO = {
    [TransitStatus.SCHEDULED]: {
        displayName: 'Programado',
        description: 'Tránsito programado, pendiente de inicio',
        color: '#9E9E9E',
        icon: 'schedule',
    },
    [TransitStatus.IN_TRANSIT]: {
        displayName: 'En tránsito',
        description: 'Vehículo en movimiento hacia destino',
        color: '#2196F3',
        icon: 'local_shipping',
    },
    [TransitStatus.PAUSED]: {
        displayName: 'Pausado',
        description: 'Tránsito temporalmente detenido',
        color: '#FF9800',
        icon: 'pause_circle',
    },
    [TransitStatus.DELAYED]: {
        displayName: 'Retrasado',
        description: 'Tránsito con retraso sobre horario',
        color: '#F44336',
        icon: 'warning',
    },
    [TransitStatus.COMPLETED]: {
        displayName: 'Completado',
        description: 'Tránsito finalizado exitosamente',
        color: '#4CAF50',
        icon: 'check_circle',
    },
    [TransitStatus.CANCELLED]: {
        displayName: 'Cancelado',
        description: 'Tránsito cancelado',
        color: '#795548',
        icon: 'cancel',
    },
};
export const VALID_STATUS_TRANSITIONS = {
    [TransitStatus.SCHEDULED]: [TransitStatus.IN_TRANSIT, TransitStatus.CANCELLED],
    [TransitStatus.IN_TRANSIT]: [TransitStatus.PAUSED, TransitStatus.DELAYED, TransitStatus.COMPLETED],
    [TransitStatus.PAUSED]: [TransitStatus.IN_TRANSIT, TransitStatus.CANCELLED],
    [TransitStatus.DELAYED]: [TransitStatus.IN_TRANSIT, TransitStatus.COMPLETED, TransitStatus.CANCELLED],
    [TransitStatus.COMPLETED]: [],
    [TransitStatus.CANCELLED]: [],
};
export function isValidStatusTransition(from, to) {
    return VALID_STATUS_TRANSITIONS[from].includes(to);
}
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(deg) {
    return deg * (Math.PI / 180);
}
export function calculateRouteDeviation(currentLat, currentLng, originLat, originLng, destLat, destLng) {
    const A = currentLat - originLat;
    const B = currentLng - originLng;
    const C = destLat - originLat;
    const D = destLng - originLng;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    let nearestLat;
    let nearestLng;
    if (param < 0) {
        nearestLat = originLat;
        nearestLng = originLng;
    }
    else if (param > 1) {
        nearestLat = destLat;
        nearestLng = destLng;
    }
    else {
        nearestLat = originLat + param * C;
        nearestLng = originLng + param * D;
    }
    return calculateDistance(currentLat, currentLng, nearestLat, nearestLng);
}
export function calculateProgress(distanceTraveled, totalDistance) {
    if (totalDistance <= 0)
        return 0;
    return Math.min(100, Math.round((distanceTraveled / totalDistance) * 100));
}
export function estimateArrival(remainingDistanceKm, currentSpeedKmh) {
    if (currentSpeedKmh <= 0 || remainingDistanceKm <= 0)
        return null;
    const hoursRemaining = remainingDistanceKm / currentSpeedKmh;
    const msRemaining = hoursRemaining * 60 * 60 * 1000;
    return new Date(Date.now() + msRemaining);
}
