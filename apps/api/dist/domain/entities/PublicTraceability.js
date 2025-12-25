import crypto from 'crypto';
export var DeviceType;
(function (DeviceType) {
    DeviceType["MOBILE"] = "MOBILE";
    DeviceType["TABLET"] = "TABLET";
    DeviceType["DESKTOP"] = "DESKTOP";
    DeviceType["UNKNOWN"] = "UNKNOWN";
})(DeviceType || (DeviceType = {}));
export function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(6);
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[bytes[i % 6] % chars.length];
    }
    return code;
}
export function generateFarmerSlug(businessName) {
    return businessName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
}
export function getCountryFlag(countryCode) {
    const flags = {
        MX: '🇲🇽',
        US: '🇺🇸',
        CA: '🇨🇦',
        ES: '🇪🇸',
        FR: '🇫🇷',
        DE: '🇩🇪',
        GB: '🇬🇧',
        JP: '🇯🇵',
        CN: '🇨🇳',
        NL: '🇳🇱',
    };
    return flags[countryCode.toUpperCase()] || '🌍';
}
export function detectDeviceType(userAgent) {
    if (!userAgent)
        return DeviceType.UNKNOWN;
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
        return DeviceType.MOBILE;
    }
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        return DeviceType.TABLET;
    }
    if (/windows|macintosh|linux/i.test(ua)) {
        return DeviceType.DESKTOP;
    }
    return DeviceType.UNKNOWN;
}
export function extractBrowser(userAgent) {
    if (!userAgent)
        return null;
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome') && !ua.includes('edg'))
        return 'Chrome';
    if (ua.includes('safari') && !ua.includes('chrome'))
        return 'Safari';
    if (ua.includes('firefox'))
        return 'Firefox';
    if (ua.includes('edg'))
        return 'Edge';
    if (ua.includes('opera') || ua.includes('opr'))
        return 'Opera';
    return 'Other';
}
export function getVarietyDisplayName(variety) {
    const names = {
        HASS: 'Hass Avocados',
        BERRIES: 'Fresh Berries',
        MANGO: 'Mangoes',
        CITRUS: 'Citrus Fruits',
    };
    return names[variety] || variety;
}
export function buildPublicUrl(shortCode, baseUrl) {
    const base = baseUrl || process.env.PUBLIC_WEB_URL || 'https://agrobridge.io';
    return `${base}/t/${shortCode}`;
}
export function buildFarmerUrl(slug, baseUrl) {
    const base = baseUrl || process.env.PUBLIC_WEB_URL || 'https://agrobridge.io';
    return `${base}/f/${slug}`;
}
export function getStageIcon(stageType) {
    const icons = {
        HARVEST: '🌾',
        PACKING: '📦',
        COLD_CHAIN: '❄️',
        EXPORT: '🚢',
        DELIVERY: '✅',
    };
    return icons[stageType] || '📍';
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
