export var ImagerySource;
(function (ImagerySource) {
    ImagerySource["SENTINEL_2"] = "SENTINEL_2";
    ImagerySource["LANDSAT_8"] = "LANDSAT_8";
    ImagerySource["PLANET"] = "PLANET";
    ImagerySource["MAXAR"] = "MAXAR";
    ImagerySource["DRONE"] = "DRONE";
})(ImagerySource || (ImagerySource = {}));
export var ImageryType;
(function (ImageryType) {
    ImageryType["RGB"] = "RGB";
    ImageryType["NDVI"] = "NDVI";
    ImageryType["NDWI"] = "NDWI";
    ImageryType["EVI"] = "EVI";
    ImageryType["SAVI"] = "SAVI";
    ImageryType["FALSE_COLOR"] = "FALSE_COLOR";
})(ImageryType || (ImageryType = {}));
export var FieldStatus;
(function (FieldStatus) {
    FieldStatus["ACTIVE"] = "ACTIVE";
    FieldStatus["FALLOW"] = "FALLOW";
    FieldStatus["HARVESTED"] = "HARVESTED";
    FieldStatus["PREPARING"] = "PREPARING";
})(FieldStatus || (FieldStatus = {}));
export const IMAGERY_SOURCE_INFO = {
    [ImagerySource.SENTINEL_2]: {
        displayName: 'Sentinel-2',
        description: 'ESA Copernicus satellite',
        resolution: '10m',
        revisitDays: 5,
        isFree: true,
    },
    [ImagerySource.LANDSAT_8]: {
        displayName: 'Landsat-8',
        description: 'NASA/USGS satellite',
        resolution: '30m',
        revisitDays: 16,
        isFree: true,
    },
    [ImagerySource.PLANET]: {
        displayName: 'Planet',
        description: 'Planet Labs constellation',
        resolution: '3m',
        revisitDays: 1,
        isFree: false,
    },
    [ImagerySource.MAXAR]: {
        displayName: 'Maxar',
        description: 'High-resolution commercial',
        resolution: '30cm',
        revisitDays: 1,
        isFree: false,
    },
    [ImagerySource.DRONE]: {
        displayName: 'Dron',
        description: 'Imágenes de dron subidas',
        resolution: 'Variable',
        revisitDays: 0,
        isFree: true,
    },
};
export const IMAGE_TYPE_INFO = {
    [ImageryType.RGB]: {
        displayName: 'Color Real',
        description: 'Vista de color verdadero',
        useCases: ['Inspección visual', 'Documentación'],
    },
    [ImageryType.NDVI]: {
        displayName: 'NDVI',
        description: 'Índice de vegetación normalizado',
        useCases: ['Salud de cultivos', 'Detección de estrés'],
    },
    [ImageryType.NDWI]: {
        displayName: 'NDWI',
        description: 'Índice de agua normalizado',
        useCases: ['Contenido de agua', 'Detección de riego'],
    },
    [ImageryType.EVI]: {
        displayName: 'EVI',
        description: 'Índice de vegetación mejorado',
        useCases: ['Biomasa', 'Cobertura vegetal densa'],
    },
    [ImageryType.SAVI]: {
        displayName: 'SAVI',
        description: 'Índice ajustado por suelo',
        useCases: ['Cultivos jóvenes', 'Cobertura escasa'],
    },
    [ImageryType.FALSE_COLOR]: {
        displayName: 'Falso Color',
        description: 'Infrarrojo cercano',
        useCases: ['Detección de vegetación', 'Límites de campo'],
    },
};
export function calculateNdvi(redBand, nirBand) {
    if (nirBand + redBand === 0)
        return 0;
    return (nirBand - redBand) / (nirBand + redBand);
}
export function calculateNdwi(greenBand, nirBand) {
    if (greenBand + nirBand === 0)
        return 0;
    return (greenBand - nirBand) / (greenBand + nirBand);
}
export function calculateEvi(blueBand, redBand, nirBand) {
    const denominator = nirBand + 6 * redBand - 7.5 * blueBand + 1;
    if (denominator === 0)
        return 0;
    return 2.5 * (nirBand - redBand) / denominator;
}
export function ndviToHealthScore(ndvi) {
    if (ndvi < 0)
        return 0;
    if (ndvi < 0.2)
        return Math.round(ndvi * 100);
    if (ndvi < 0.4)
        return Math.round(20 + (ndvi - 0.2) * 150);
    if (ndvi < 0.6)
        return Math.round(50 + (ndvi - 0.4) * 150);
    if (ndvi < 0.8)
        return Math.round(80 + (ndvi - 0.6) * 75);
    return Math.min(100, Math.round(95 + (ndvi - 0.8) * 25));
}
export function getHealthCategory(score) {
    if (score >= 80)
        return 'EXCELLENT';
    if (score >= 60)
        return 'GOOD';
    if (score >= 40)
        return 'FAIR';
    if (score >= 20)
        return 'POOR';
    return 'CRITICAL';
}
export function calculateNdviTrend(values) {
    if (values.length < 3)
        return 'UNKNOWN';
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    if (slope > 0.01)
        return 'IMPROVING';
    if (slope < -0.01)
        return 'DECLINING';
    return 'STABLE';
}
export function isValidGeoJsonPolygon(geoJson) {
    if (geoJson.type !== 'Polygon')
        return false;
    if (!Array.isArray(geoJson.coordinates) || geoJson.coordinates.length === 0)
        return false;
    const ring = geoJson.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4)
        return false;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1])
        return false;
    for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2)
            return false;
        const [lng, lat] = point;
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90)
            return false;
    }
    return true;
}
export function calculateCentroid(polygon) {
    const ring = polygon.coordinates[0];
    let sumLat = 0;
    let sumLng = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        sumLng += ring[i][0];
        sumLat += ring[i][1];
    }
    const count = ring.length - 1;
    return {
        latitude: sumLat / count,
        longitude: sumLng / count,
    };
}
export function calculateAreaHectares(polygon) {
    const ring = polygon.coordinates[0];
    if (ring.length < 4)
        return 0;
    const { latitude } = calculateCentroid(polygon);
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(latitude * Math.PI / 180);
    let area = 0;
    const n = ring.length - 1;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const x1 = ring[i][0] * metersPerDegreeLng;
        const y1 = ring[i][1] * metersPerDegreeLat;
        const x2 = ring[j][0] * metersPerDegreeLng;
        const y2 = ring[j][1] * metersPerDegreeLat;
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2) / 10000;
}
