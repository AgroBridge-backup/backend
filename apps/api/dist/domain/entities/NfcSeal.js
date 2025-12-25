import crypto from 'crypto';
export var NfcSealStatus;
(function (NfcSealStatus) {
    NfcSealStatus["PROVISIONED"] = "PROVISIONED";
    NfcSealStatus["ATTACHED"] = "ATTACHED";
    NfcSealStatus["VERIFIED"] = "VERIFIED";
    NfcSealStatus["TAMPERED"] = "TAMPERED";
    NfcSealStatus["REMOVED"] = "REMOVED";
    NfcSealStatus["EXPIRED"] = "EXPIRED";
})(NfcSealStatus || (NfcSealStatus = {}));
export var TamperIndicator;
(function (TamperIndicator) {
    TamperIndicator["NONE"] = "NONE";
    TamperIndicator["SIGNATURE_MISMATCH"] = "SIGNATURE_MISMATCH";
    TamperIndicator["COUNTER_ANOMALY"] = "COUNTER_ANOMALY";
    TamperIndicator["PHYSICAL_DAMAGE"] = "PHYSICAL_DAMAGE";
    TamperIndicator["LOCATION_MISMATCH"] = "LOCATION_MISMATCH";
    TamperIndicator["TIMING_ANOMALY"] = "TIMING_ANOMALY";
})(TamperIndicator || (TamperIndicator = {}));
export const NFC_SEAL_STATUS_INFO = {
    [NfcSealStatus.PROVISIONED]: {
        displayName: 'Provisionado',
        description: 'Sello creado, listo para asignar',
        color: '#9E9E9E',
        icon: 'inventory',
    },
    [NfcSealStatus.ATTACHED]: {
        displayName: 'Adjunto',
        description: 'Sello adjunto al contenedor',
        color: '#2196F3',
        icon: 'link',
    },
    [NfcSealStatus.VERIFIED]: {
        displayName: 'Verificado',
        description: 'Sello verificado exitosamente',
        color: '#4CAF50',
        icon: 'verified',
    },
    [NfcSealStatus.TAMPERED]: {
        displayName: 'Alterado',
        description: 'Se detectó manipulación',
        color: '#F44336',
        icon: 'warning',
    },
    [NfcSealStatus.REMOVED]: {
        displayName: 'Removido',
        description: 'Sello removido en destino',
        color: '#FF9800',
        icon: 'link_off',
    },
    [NfcSealStatus.EXPIRED]: {
        displayName: 'Expirado',
        description: 'Sello fuera de período válido',
        color: '#795548',
        icon: 'schedule',
    },
};
export const TAMPER_INDICATOR_INFO = {
    [TamperIndicator.NONE]: {
        displayName: 'Sin alteración',
        description: 'No se detectó manipulación',
        severity: 'none',
    },
    [TamperIndicator.SIGNATURE_MISMATCH]: {
        displayName: 'Firma inválida',
        description: 'La firma criptográfica no coincide',
        severity: 'critical',
    },
    [TamperIndicator.COUNTER_ANOMALY]: {
        displayName: 'Anomalía de contador',
        description: 'El contador NFC muestra valor inesperado',
        severity: 'critical',
    },
    [TamperIndicator.PHYSICAL_DAMAGE]: {
        displayName: 'Daño físico',
        description: 'Se reportó daño físico al sello',
        severity: 'critical',
    },
    [TamperIndicator.LOCATION_MISMATCH]: {
        displayName: 'Ubicación inesperada',
        description: 'Escaneo fuera de la ruta esperada',
        severity: 'warning',
    },
    [TamperIndicator.TIMING_ANOMALY]: {
        displayName: 'Anomalía temporal',
        description: 'Tiempo inusual entre escaneos',
        severity: 'warning',
    },
};
export function generateSealKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
}
export function generateChallenge() {
    return crypto.randomBytes(32).toString('hex');
}
export function signChallenge(challenge, privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(challenge);
    return sign.sign(privateKey, 'hex');
}
export function verifySignature(challenge, signature, publicKey) {
    try {
        const verify = crypto.createVerify('SHA256');
        verify.update(challenge);
        return verify.verify(publicKey, signature, 'hex');
    }
    catch {
        return false;
    }
}
export function encryptPrivateKey(privateKey, masterKey) {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(masterKey, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
export function decryptPrivateKey(encryptedData, masterKey) {
    const parts = encryptedData.split(':');
    let saltHex;
    let ivHex;
    let authTagHex;
    let encrypted;
    if (parts.length === 4) {
        [saltHex, ivHex, authTagHex, encrypted] = parts;
    }
    else if (parts.length === 3) {
        [ivHex, authTagHex, encrypted] = parts;
        saltHex = Buffer.from('agrobridge-nfc-salt').toString('hex');
    }
    else {
        throw new Error('Invalid encrypted data format');
    }
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(masterKey, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
export function canAttachSeal(seal) {
    return seal.status === NfcSealStatus.PROVISIONED && seal.batchId === null;
}
export function canVerifySeal(seal) {
    return [NfcSealStatus.ATTACHED, NfcSealStatus.VERIFIED].includes(seal.status);
}
export function canRemoveSeal(seal) {
    return [NfcSealStatus.ATTACHED, NfcSealStatus.VERIFIED].includes(seal.status);
}
export function isSealExpired(seal) {
    if (!seal.expiresAt)
        return false;
    return new Date() > seal.expiresAt;
}
export function detectCounterAnomaly(expectedCount, actualCount) {
    if (actualCount < expectedCount)
        return true;
    if (actualCount > expectedCount + 10)
        return true;
    return false;
}
export function isValidSerialNumber(serialNumber) {
    const hexPattern = /^[0-9A-Fa-f]{8,14}$/;
    return hexPattern.test(serialNumber);
}
export function calculateIntegrityScore(seal, verifications) {
    if (seal.status === NfcSealStatus.TAMPERED)
        return 0;
    if (seal.status === NfcSealStatus.EXPIRED)
        return 50;
    let score = 100;
    const failedVerifications = verifications.filter(v => !v.isValid);
    score -= failedVerifications.length * 20;
    if (detectCounterAnomaly(seal.expectedReadCount, seal.actualReadCount)) {
        score -= 30;
    }
    if (seal.tamperIndicator !== TamperIndicator.NONE) {
        const severity = TAMPER_INDICATOR_INFO[seal.tamperIndicator].severity;
        if (severity === 'critical')
            score -= 50;
        if (severity === 'warning')
            score -= 20;
    }
    return Math.max(0, Math.min(100, score));
}
