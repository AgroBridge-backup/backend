/**
 * Traceability 2.0 - Tamper-Evident NFC Seals
 * Domain Entity for NFC Seal Management
 */

import crypto from "crypto";

export enum NfcSealStatus {
  PROVISIONED = "PROVISIONED", // Seal created but not attached
  ATTACHED = "ATTACHED", // Seal attached to batch container
  VERIFIED = "VERIFIED", // Seal verified during transit/inspection
  TAMPERED = "TAMPERED", // Seal shows signs of tampering
  REMOVED = "REMOVED", // Seal legitimately removed at destination
  EXPIRED = "EXPIRED", // Seal past validity period
}

export enum TamperIndicator {
  NONE = "NONE", // No tampering detected
  SIGNATURE_MISMATCH = "SIGNATURE_MISMATCH", // Cryptographic signature invalid
  COUNTER_ANOMALY = "COUNTER_ANOMALY", // NFC read counter shows unexpected value
  PHYSICAL_DAMAGE = "PHYSICAL_DAMAGE", // Physical damage reported
  LOCATION_MISMATCH = "LOCATION_MISMATCH", // Scanned outside expected route
  TIMING_ANOMALY = "TIMING_ANOMALY", // Unusual time between scans
}

export interface NfcSeal {
  id: string;
  serialNumber: string; // Unique NFC chip serial number
  batchId: string | null; // Associated batch (null if unassigned)
  status: NfcSealStatus;
  publicKey: string; // Public key for signature verification
  encryptedPrivateKey: string; // Encrypted private key (stored securely)
  challenge: string | null; // Current challenge for next verification
  expectedReadCount: number; // Expected NFC read counter value
  actualReadCount: number; // Last known read counter
  attachedAt: Date | null;
  attachedBy: string | null;
  attachedLocation: string | null;
  attachedLatitude: number | null;
  attachedLongitude: number | null;
  removedAt: Date | null;
  removedBy: string | null;
  removedLocation: string | null;
  tamperIndicator: TamperIndicator;
  tamperDetails: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NfcSealVerification {
  id: string;
  sealId: string;
  verifiedBy: string;
  verifiedAt: Date;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  readCounter: number;
  signatureProvided: string;
  signatureExpected: string;
  challengeUsed: string;
  isValid: boolean;
  tamperIndicator: TamperIndicator;
  tamperDetails: string | null;
  deviceInfo: string | null;
}

export interface CreateNfcSealInput {
  serialNumber: string;
  expiresAt?: Date;
}

export interface AttachNfcSealInput {
  sealId: string;
  batchId: string;
  attachedBy: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

export interface VerifyNfcSealInput {
  serialNumber: string;
  signature: string;
  readCounter: number;
  verifiedBy: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
}

export interface RemoveNfcSealInput {
  sealId: string;
  removedBy: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  reason?: string;
}

/**
 * NFC Seal status display information
 */
export const NFC_SEAL_STATUS_INFO: Record<
  NfcSealStatus,
  {
    displayName: string;
    description: string;
    color: string;
    icon: string;
  }
> = {
  [NfcSealStatus.PROVISIONED]: {
    displayName: "Provisionado",
    description: "Sello creado, listo para asignar",
    color: "#9E9E9E",
    icon: "inventory",
  },
  [NfcSealStatus.ATTACHED]: {
    displayName: "Adjunto",
    description: "Sello adjunto al contenedor",
    color: "#2196F3",
    icon: "link",
  },
  [NfcSealStatus.VERIFIED]: {
    displayName: "Verificado",
    description: "Sello verificado exitosamente",
    color: "#4CAF50",
    icon: "verified",
  },
  [NfcSealStatus.TAMPERED]: {
    displayName: "Alterado",
    description: "Se detectó manipulación",
    color: "#F44336",
    icon: "warning",
  },
  [NfcSealStatus.REMOVED]: {
    displayName: "Removido",
    description: "Sello removido en destino",
    color: "#FF9800",
    icon: "link_off",
  },
  [NfcSealStatus.EXPIRED]: {
    displayName: "Expirado",
    description: "Sello fuera de período válido",
    color: "#795548",
    icon: "schedule",
  },
};

/**
 * Tamper indicator display information
 */
export const TAMPER_INDICATOR_INFO: Record<
  TamperIndicator,
  {
    displayName: string;
    description: string;
    severity: "none" | "warning" | "critical";
  }
> = {
  [TamperIndicator.NONE]: {
    displayName: "Sin alteración",
    description: "No se detectó manipulación",
    severity: "none",
  },
  [TamperIndicator.SIGNATURE_MISMATCH]: {
    displayName: "Firma inválida",
    description: "La firma criptográfica no coincide",
    severity: "critical",
  },
  [TamperIndicator.COUNTER_ANOMALY]: {
    displayName: "Anomalía de contador",
    description: "El contador NFC muestra valor inesperado",
    severity: "critical",
  },
  [TamperIndicator.PHYSICAL_DAMAGE]: {
    displayName: "Daño físico",
    description: "Se reportó daño físico al sello",
    severity: "critical",
  },
  [TamperIndicator.LOCATION_MISMATCH]: {
    displayName: "Ubicación inesperada",
    description: "Escaneo fuera de la ruta esperada",
    severity: "warning",
  },
  [TamperIndicator.TIMING_ANOMALY]: {
    displayName: "Anomalía temporal",
    description: "Tiempo inusual entre escaneos",
    severity: "warning",
  },
};

/**
 * Generate a new keypair for NFC seal
 */
export function generateSealKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { publicKey, privateKey };
}

/**
 * Generate a random challenge for NFC verification
 */
export function generateChallenge(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Sign a challenge with the seal's private key
 */
export function signChallenge(challenge: string, privateKey: string): string {
  const sign = crypto.createSign("SHA256");
  sign.update(challenge);
  return sign.sign(privateKey, "hex");
}

/**
 * Verify a signature against a challenge and public key
 */
export function verifySignature(
  challenge: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const verify = crypto.createVerify("SHA256");
    verify.update(challenge);
    return verify.verify(publicKey, signature, "hex");
  } catch {
    return false;
  }
}

/**
 * Encrypt private key for storage
 * Uses random salt for each encryption to prevent rainbow table attacks
 */
export function encryptPrivateKey(
  privateKey: string,
  masterKey: string,
): string {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(masterKey, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:encrypted
  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt private key from storage
 */
export function decryptPrivateKey(
  encryptedData: string,
  masterKey: string,
): string {
  const parts = encryptedData.split(":");

  // Support both old format (iv:authTag:encrypted) and new format (salt:iv:authTag:encrypted)
  let saltHex: string;
  let ivHex: string;
  let authTagHex: string;
  let encrypted: string;

  if (parts.length === 4) {
    // New format with random salt
    [saltHex, ivHex, authTagHex, encrypted] = parts;
  } else if (parts.length === 3) {
    // Legacy format with hardcoded salt - for backwards compatibility
    [ivHex, authTagHex, encrypted] = parts;
    saltHex = Buffer.from("agrobridge-nfc-salt").toString("hex");
  } else {
    throw new Error("Invalid encrypted data format");
  }

  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.scryptSync(masterKey, salt, 32);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if a seal is in a valid state for attachment
 */
export function canAttachSeal(seal: NfcSeal): boolean {
  return seal.status === NfcSealStatus.PROVISIONED && seal.batchId === null;
}

/**
 * Check if a seal is in a valid state for verification
 */
export function canVerifySeal(seal: NfcSeal): boolean {
  return [NfcSealStatus.ATTACHED, NfcSealStatus.VERIFIED].includes(seal.status);
}

/**
 * Check if a seal is in a valid state for removal
 */
export function canRemoveSeal(seal: NfcSeal): boolean {
  return [NfcSealStatus.ATTACHED, NfcSealStatus.VERIFIED].includes(seal.status);
}

/**
 * Check if seal has expired
 */
export function isSealExpired(seal: NfcSeal): boolean {
  if (!seal.expiresAt) return false;
  return new Date() > seal.expiresAt;
}

/**
 * Detect tampering based on read counter
 */
export function detectCounterAnomaly(
  expectedCount: number,
  actualCount: number,
): boolean {
  // Counter should only increase
  // Allow small tolerance for legitimate reads
  if (actualCount < expectedCount) return true;
  if (actualCount > expectedCount + 10) return true; // Suspicious if many unexpected reads
  return false;
}

/**
 * Validate NFC serial number format
 */
export function isValidSerialNumber(serialNumber: string): boolean {
  // NFC serial numbers are typically 7 or 4 bytes in hex
  const hexPattern = /^[0-9A-Fa-f]{8,14}$/;
  return hexPattern.test(serialNumber);
}

/**
 * Calculate seal integrity score (0-100)
 */
export function calculateIntegrityScore(
  seal: NfcSeal,
  verifications: NfcSealVerification[],
): number {
  if (seal.status === NfcSealStatus.TAMPERED) return 0;
  if (seal.status === NfcSealStatus.EXPIRED) return 50;

  let score = 100;

  // Deduct for each failed verification
  const failedVerifications = verifications.filter((v) => !v.isValid);
  score -= failedVerifications.length * 20;

  // Deduct for counter anomalies
  if (detectCounterAnomaly(seal.expectedReadCount, seal.actualReadCount)) {
    score -= 30;
  }

  // Deduct for tamper indicators
  if (seal.tamperIndicator !== TamperIndicator.NONE) {
    const severity = TAMPER_INDICATOR_INFO[seal.tamperIndicator].severity;
    if (severity === "critical") score -= 50;
    if (severity === "warning") score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}
