/**
 * Farmer Storytelling & Consumer Traceability
 * Domain Entities for Public-Facing Traceability Links
 */

import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC TRACEABILITY LINK
// Maps batch IDs to short, shareable codes for QR generation
// ═══════════════════════════════════════════════════════════════════════════════

export interface PublicTraceabilityLink {
  id: string;
  batchId: string;
  shortCode: string; // 8-char alphanumeric, e.g., "A1B2C3D4"
  publicUrl: string;
  qrImageUrl: string | null;
  isActive: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface CreatePublicLinkInput {
  batchId: string;
  expiresAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR SCAN EVENT (Privacy-Safe Analytics)
// ═══════════════════════════════════════════════════════════════════════════════

export interface QrScanEvent {
  id: string;
  shortCode: string;
  timestamp: Date;
  country: string | null;
  city: string | null;
  deviceType: DeviceType;
  browser: string | null;
  referrer: string | null;
  userAgent: string | null;
}

export enum DeviceType {
  MOBILE = "MOBILE",
  TABLET = "TABLET",
  DESKTOP = "DESKTOP",
  UNKNOWN = "UNKNOWN",
}

export interface RecordScanInput {
  shortCode: string;
  userAgent?: string;
  referrer?: string;
  ip?: string; // For geo-lookup, not stored
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC FARMER PROFILE (Read-Only, Privacy-Respecting)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PublicFarmerProfile {
  id: string;
  slug: string;
  displayName: string;
  photoUrl: string | null;
  region: string; // e.g., "Uruapan, Michoacán"
  country: string;
  countryFlag: string; // e.g., "🇲🇽"
  story: string | null; // 2-3 sentence bio
  mainCrops: string[];
  yearsOfExperience: number | null;
  certifications: PublicCertification[];
  stats: FarmerStats;
  field?: PublicFieldInfo;
}

export interface PublicCertification {
  name: string;
  issuedBy: string;
  validUntil: Date | null;
  badgeUrl: string | null;
}

export interface FarmerStats {
  totalLotsExported: number;
  blockchainVerifiedLots: number;
  averageHealthScore: number | null; // NDVI-based
  countriesExportedTo: string[];
}

export interface PublicFieldInfo {
  name: string;
  areaHectares: number;
  currentCrop: string | null;
  centerLatitude: number;
  centerLongitude: number;
  boundaryGeoJson?: object; // Optional for map display
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC BATCH TRACEABILITY (Consumer-Facing, 5-Second Comprehension)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PublicBatchTraceability {
  // Core Info (Above the Fold)
  shortCode: string;
  product: ProductInfo;
  farmer: FarmerPreview;
  keyFacts: KeyFact[];
  verificationBadge: VerificationBadge;

  // Journey Timeline
  journey: JourneyStage[];

  // Transit & Map
  transit: TransitSummary | null;

  // Cold Chain
  coldChain: ColdChainSummary | null;

  // NFC Seal
  sealStatus: SealStatus | null;

  // Satellite/Field Health
  fieldHealth: FieldHealthSummary | null;

  // Blockchain Certificate
  certificate: CertificateSummary | null;

  // Social/SEO
  shareInfo: ShareInfo;
}

export interface ProductInfo {
  name: string; // e.g., "Hass Avocados"
  variety: string;
  origin: string; // e.g., "Michoacán, Mexico"
  originFlag: string;
  harvestDate: Date;
  weightKg: number;
  destinationCountry: string | null;
}

export interface FarmerPreview {
  id: string;
  slug: string;
  displayName: string;
  photoUrl: string | null;
  region: string;
}

export interface KeyFact {
  icon: string; // emoji or icon name
  label: string;
  value: string;
  highlight?: boolean;
}

export interface VerificationBadge {
  status: "VERIFIED" | "PARTIAL" | "PENDING";
  label: string;
  blockchainHash: string | null;
  blockchainUrl: string | null;
}

export interface JourneyStage {
  name: string; // e.g., "Harvest", "Packing", "Cold Chain", "Export", "Delivery"
  status: "COMPLETED" | "CURRENT" | "PENDING" | "SKIPPED";
  date: Date | null;
  location: string | null;
  actor: string | null; // Role, not name for privacy
  icon: string;
}

export interface TransitSummary {
  status: string;
  originName: string;
  destinationName: string;
  currentLocation: string | null;
  distanceTraveledKm: number;
  totalDistanceKm: number;
  progressPercent: number;
  estimatedArrival: Date | null;
  lastUpdate: Date | null;
  mapPreviewUrl: string | null;
}

export interface ColdChainSummary {
  isCompliant: boolean;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  readingCount: number;
  outOfRangeCount: number;
  thresholdMin: number;
  thresholdMax: number;
  lastReading: Date | null;
  chartData: { timestamp: string; value: number }[];
}

export interface SealStatus {
  status: "INTACT" | "VERIFIED" | "BROKEN" | "NOT_APPLIED";
  label: string;
  lastVerified: Date | null;
  verificationCount: number;
  integrityScore: number;
}

export interface FieldHealthSummary {
  healthScore: number; // 0-100
  healthCategory: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";
  ndviValue: number;
  lastCaptureDate: Date;
  thumbnailUrl: string | null;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
}

export interface CertificateSummary {
  grade: string;
  certifyingBody: string;
  validFrom: Date;
  validTo: Date;
  isValid: boolean;
  pdfUrl: string | null;
  blockchainHash: string;
  blockchainUrl: string | null;
}

export interface ShareInfo {
  title: string;
  description: string;
  imageUrl: string | null;
  url: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCAN ANALYTICS AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScanAnalytics {
  shortCode: string;
  batchId: string;
  totalScans: number;
  uniqueCountries: number;
  scansByCountry: { country: string; count: number }[];
  scansByDevice: { device: DeviceType; count: number }[];
  scansByDay: { date: string; count: number }[];
  last30DaysScans: number;
  lastScanAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique, URL-safe short code (8 characters)
 */
export function generateShortCode(): string {
  // Use base62 (alphanumeric) for URL-safe codes
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i % 6] % chars.length];
  }
  return code;
}

/**
 * Generate a farmer slug from business name
 */
export function generateFarmerSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

/**
 * Get country flag emoji from country code
 */
export function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    MX: "🇲🇽",
    US: "🇺🇸",
    CA: "🇨🇦",
    ES: "🇪🇸",
    FR: "🇫🇷",
    DE: "🇩🇪",
    GB: "🇬🇧",
    JP: "🇯🇵",
    CN: "🇨🇳",
    NL: "🇳🇱",
  };
  return flags[countryCode.toUpperCase()] || "🌍";
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(userAgent: string | undefined): DeviceType {
  if (!userAgent) return DeviceType.UNKNOWN;
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

/**
 * Extract browser name from user agent
 */
export function extractBrowser(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes("chrome") && !ua.includes("edg")) return "Chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("edg")) return "Edge";
  if (ua.includes("opera") || ua.includes("opr")) return "Opera";
  return "Other";
}

/**
 * Get variety display name
 */
export function getVarietyDisplayName(variety: string): string {
  const names: Record<string, string> = {
    HASS: "Hass Avocados",
    BERRIES: "Fresh Berries",
    MANGO: "Mangoes",
    CITRUS: "Citrus Fruits",
  };
  return names[variety] || variety;
}

/**
 * Build public URL for traceability page
 */
export function buildPublicUrl(shortCode: string, baseUrl?: string): string {
  const base = baseUrl || process.env.PUBLIC_WEB_URL || "https://agrobridge.io";
  return `${base}/t/${shortCode}`;
}

/**
 * Build public URL for farmer profile
 */
export function buildFarmerUrl(slug: string, baseUrl?: string): string {
  const base = baseUrl || process.env.PUBLIC_WEB_URL || "https://agrobridge.io";
  return `${base}/f/${slug}`;
}

/**
 * Get stage icon by type
 */
export function getStageIcon(stageType: string): string {
  const icons: Record<string, string> = {
    HARVEST: "🌾",
    PACKING: "📦",
    COLD_CHAIN: "❄️",
    EXPORT: "🚢",
    DELIVERY: "✅",
  };
  return icons[stageType] || "📍";
}

/**
 * Get health category from score
 */
export function getHealthCategory(
  score: number,
): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL" {
  if (score >= 80) return "EXCELLENT";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "FAIR";
  if (score >= 20) return "POOR";
  return "CRITICAL";
}
