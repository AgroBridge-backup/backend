export var CertificateGrade;
(function (CertificateGrade) {
    CertificateGrade["STANDARD"] = "STANDARD";
    CertificateGrade["PREMIUM"] = "PREMIUM";
    CertificateGrade["EXPORT"] = "EXPORT";
    CertificateGrade["ORGANIC"] = "ORGANIC";
})(CertificateGrade || (CertificateGrade = {}));
export const CERTIFICATE_GRADE_INFO = {
    [CertificateGrade.STANDARD]: {
        displayName: 'Estándar',
        description: 'Certificado básico de calidad',
        color: '#9E9E9E',
    },
    [CertificateGrade.PREMIUM]: {
        displayName: 'Premium',
        description: 'Calidad superior verificada',
        color: '#FFD700',
    },
    [CertificateGrade.EXPORT]: {
        displayName: 'Exportación',
        description: 'Apto para mercados internacionales',
        color: '#2196F3',
    },
    [CertificateGrade.ORGANIC]: {
        displayName: 'Orgánico',
        description: 'Certificación orgánica verificada',
        color: '#4CAF50',
    },
};
export const REQUIRED_STAGES_BY_GRADE = {
    [CertificateGrade.STANDARD]: ['HARVEST', 'PACKING'],
    [CertificateGrade.PREMIUM]: ['HARVEST', 'PACKING', 'COLD_CHAIN'],
    [CertificateGrade.EXPORT]: ['HARVEST', 'PACKING', 'COLD_CHAIN', 'EXPORT', 'DELIVERY'],
    [CertificateGrade.ORGANIC]: ['HARVEST', 'PACKING', 'COLD_CHAIN', 'EXPORT', 'DELIVERY'],
};
const GRADE_HIERARCHY = {
    [CertificateGrade.STANDARD]: 1,
    [CertificateGrade.PREMIUM]: 2,
    [CertificateGrade.EXPORT]: 3,
    [CertificateGrade.ORGANIC]: 4,
};
export function isCertificateValid(certificate) {
    const now = new Date();
    return certificate.validFrom <= now && certificate.validTo >= now;
}
export function canUpgradeToGrade(currentGrade, targetGrade) {
    return GRADE_HIERARCHY[targetGrade] > GRADE_HIERARCHY[currentGrade];
}
