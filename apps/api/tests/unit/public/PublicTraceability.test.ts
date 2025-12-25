/**
 * Public Traceability Unit Tests
 * Feature 6: Consumer QR Code + Public Storytelling
 *
 * Tests all utility functions and domain logic for public-facing
 * traceability features designed for 5-second mobile comprehension.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateShortCode,
  generateFarmerSlug,
  getCountryFlag,
  detectDeviceType,
  extractBrowser,
  getVarietyDisplayName,
  buildPublicUrl,
  buildFarmerUrl,
  getStageIcon,
  getHealthCategory,
  DeviceType,
} from '../../../src/domain/entities/PublicTraceability.js';

// ═══════════════════════════════════════════════════════════════════════════════
// generateShortCode() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateShortCode()', () => {
  it('should generate an 8-character code', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(8);
  });

  it('should only contain alphanumeric characters (base62)', () => {
    const code = generateShortCode();
    expect(code).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('should generate unique codes on consecutive calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateShortCode());
    }
    // All 100 codes should be unique
    expect(codes.size).toBe(100);
  });

  it('should be URL-safe (no special characters)', () => {
    const code = generateShortCode();
    expect(code).not.toMatch(/[^A-Za-z0-9]/);
    // Can be used directly in URL without encoding
    expect(encodeURIComponent(code)).toBe(code);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateFarmerSlug() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateFarmerSlug()', () => {
  it('should convert business name to lowercase slug', () => {
    const slug = generateFarmerSlug('Rancho Los Aguacates');
    expect(slug).toBe('rancho-los-aguacates');
  });

  it('should remove diacritics (accents)', () => {
    const slug = generateFarmerSlug('Producción García Núñez');
    expect(slug).toBe('produccion-garcia-nunez');
  });

  it('should remove special characters', () => {
    const slug = generateFarmerSlug("María's Farm & Co.");
    // Apostrophe is removed, accents normalized, & removed
    expect(slug).toBe('marias-farm-co');
  });

  it('should replace multiple spaces with single hyphen', () => {
    const slug = generateFarmerSlug('Big   Spaces   Farm');
    expect(slug).toBe('big-spaces-farm');
  });

  it('should truncate to 50 characters maximum', () => {
    const longName = 'A'.repeat(100);
    const slug = generateFarmerSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it('should handle empty string', () => {
    const slug = generateFarmerSlug('');
    expect(slug).toBe('');
  });

  it('should handle Unicode business names', () => {
    const slug = generateFarmerSlug('Finca café élite');
    expect(slug).toBe('finca-cafe-elite');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getCountryFlag() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('getCountryFlag()', () => {
  it('should return Mexican flag for MX', () => {
    expect(getCountryFlag('MX')).toBe('🇲🇽');
  });

  it('should return US flag for US', () => {
    expect(getCountryFlag('US')).toBe('🇺🇸');
  });

  it('should return Canadian flag for CA', () => {
    expect(getCountryFlag('CA')).toBe('🇨🇦');
  });

  it('should handle lowercase country codes', () => {
    expect(getCountryFlag('mx')).toBe('🇲🇽');
    expect(getCountryFlag('us')).toBe('🇺🇸');
  });

  it('should return globe emoji for unknown country codes', () => {
    expect(getCountryFlag('XX')).toBe('🌍');
    expect(getCountryFlag('ZZ')).toBe('🌍');
  });

  it('should return globe emoji for empty string', () => {
    expect(getCountryFlag('')).toBe('🌍');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// detectDeviceType() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectDeviceType()', () => {
  it('should detect iPhone as MOBILE', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(detectDeviceType(ua)).toBe(DeviceType.MOBILE);
  });

  it('should detect Android phone as MOBILE', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36';
    expect(detectDeviceType(ua)).toBe(DeviceType.MOBILE);
  });

  it('should detect iPad as TABLET', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(detectDeviceType(ua)).toBe(DeviceType.TABLET);
  });

  it('should detect Windows as DESKTOP', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    expect(detectDeviceType(ua)).toBe(DeviceType.DESKTOP);
  });

  it('should detect macOS as DESKTOP', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    expect(detectDeviceType(ua)).toBe(DeviceType.DESKTOP);
  });

  it('should detect Linux as DESKTOP', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
    expect(detectDeviceType(ua)).toBe(DeviceType.DESKTOP);
  });

  it('should return UNKNOWN for undefined user agent', () => {
    expect(detectDeviceType(undefined)).toBe(DeviceType.UNKNOWN);
  });

  it('should return UNKNOWN for empty user agent', () => {
    expect(detectDeviceType('')).toBe(DeviceType.UNKNOWN);
  });

  it('should return UNKNOWN for unrecognized user agent', () => {
    expect(detectDeviceType('curl/7.64.1')).toBe(DeviceType.UNKNOWN);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractBrowser() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractBrowser()', () => {
  it('should detect Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    expect(extractBrowser(ua)).toBe('Chrome');
  });

  it('should detect Safari (not Chrome)', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
    expect(extractBrowser(ua)).toBe('Safari');
  });

  it('should detect Firefox', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
    expect(extractBrowser(ua)).toBe('Firefox');
  });

  it('should detect Edge (not Chrome)', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
    expect(extractBrowser(ua)).toBe('Edge');
  });

  it('should detect Opera', () => {
    // Opera is detected when 'opr' appears in UA - implementation checks Chrome first
    // So we need to verify the actual implementation behavior
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Opera/77.0';
    expect(extractBrowser(ua)).toBe('Opera');
  });

  it('should return null for undefined user agent', () => {
    expect(extractBrowser(undefined)).toBeNull();
  });

  it('should return Other for unrecognized browser', () => {
    expect(extractBrowser('curl/7.64.1')).toBe('Other');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getVarietyDisplayName() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('getVarietyDisplayName()', () => {
  it('should return human-readable name for HASS', () => {
    expect(getVarietyDisplayName('HASS')).toBe('Hass Avocados');
  });

  it('should return human-readable name for BERRIES', () => {
    expect(getVarietyDisplayName('BERRIES')).toBe('Fresh Berries');
  });

  it('should return human-readable name for MANGO', () => {
    expect(getVarietyDisplayName('MANGO')).toBe('Mangoes');
  });

  it('should return human-readable name for CITRUS', () => {
    expect(getVarietyDisplayName('CITRUS')).toBe('Citrus Fruits');
  });

  it('should return original variety for unknown types', () => {
    expect(getVarietyDisplayName('DRAGON_FRUIT')).toBe('DRAGON_FRUIT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildPublicUrl() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildPublicUrl()', () => {
  const originalEnv = process.env.PUBLIC_WEB_URL;

  afterEach(() => {
    process.env.PUBLIC_WEB_URL = originalEnv;
  });

  it('should build URL with short code', () => {
    const url = buildPublicUrl('ABC12345', 'https://test.com');
    expect(url).toBe('https://test.com/t/ABC12345');
  });

  it('should use custom base URL when provided', () => {
    const url = buildPublicUrl('XYZ789', 'https://custom.example.com');
    expect(url).toBe('https://custom.example.com/t/XYZ789');
  });

  it('should use environment variable when no base URL provided', () => {
    process.env.PUBLIC_WEB_URL = 'https://env.agrobridge.io';
    const url = buildPublicUrl('ENV123');
    expect(url).toBe('https://env.agrobridge.io/t/ENV123');
  });

  it('should use default URL when no base URL or env var', () => {
    delete process.env.PUBLIC_WEB_URL;
    const url = buildPublicUrl('DEF456');
    expect(url).toBe('https://agrobridge.io/t/DEF456');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildFarmerUrl() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildFarmerUrl()', () => {
  const originalEnv = process.env.PUBLIC_WEB_URL;

  afterEach(() => {
    process.env.PUBLIC_WEB_URL = originalEnv;
  });

  it('should build farmer profile URL with slug', () => {
    const url = buildFarmerUrl('maria-garcia', 'https://test.com');
    expect(url).toBe('https://test.com/f/maria-garcia');
  });

  it('should use /f/ path for farmer profiles', () => {
    const url = buildFarmerUrl('rancho-los-aguacates', 'https://agrobridge.io');
    expect(url).toContain('/f/');
  });

  it('should use default URL when no base URL provided', () => {
    delete process.env.PUBLIC_WEB_URL;
    const url = buildFarmerUrl('test-farmer');
    expect(url).toBe('https://agrobridge.io/f/test-farmer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getStageIcon() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('getStageIcon()', () => {
  it('should return harvest icon for HARVEST stage', () => {
    expect(getStageIcon('HARVEST')).toBe('🌾');
  });

  it('should return packing icon for PACKING stage', () => {
    expect(getStageIcon('PACKING')).toBe('📦');
  });

  it('should return cold chain icon for COLD_CHAIN stage', () => {
    expect(getStageIcon('COLD_CHAIN')).toBe('❄️');
  });

  it('should return export icon for EXPORT stage', () => {
    expect(getStageIcon('EXPORT')).toBe('🚢');
  });

  it('should return delivery icon for DELIVERY stage', () => {
    expect(getStageIcon('DELIVERY')).toBe('✅');
  });

  it('should return default location pin for unknown stages', () => {
    expect(getStageIcon('UNKNOWN_STAGE')).toBe('📍');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getHealthCategory() Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('getHealthCategory()', () => {
  it('should return EXCELLENT for scores >= 80', () => {
    expect(getHealthCategory(80)).toBe('EXCELLENT');
    expect(getHealthCategory(95)).toBe('EXCELLENT');
    expect(getHealthCategory(100)).toBe('EXCELLENT');
  });

  it('should return GOOD for scores 60-79', () => {
    expect(getHealthCategory(60)).toBe('GOOD');
    expect(getHealthCategory(70)).toBe('GOOD');
    expect(getHealthCategory(79)).toBe('GOOD');
  });

  it('should return FAIR for scores 40-59', () => {
    expect(getHealthCategory(40)).toBe('FAIR');
    expect(getHealthCategory(50)).toBe('FAIR');
    expect(getHealthCategory(59)).toBe('FAIR');
  });

  it('should return POOR for scores 20-39', () => {
    expect(getHealthCategory(20)).toBe('POOR');
    expect(getHealthCategory(30)).toBe('POOR');
    expect(getHealthCategory(39)).toBe('POOR');
  });

  it('should return CRITICAL for scores < 20', () => {
    expect(getHealthCategory(0)).toBe('CRITICAL');
    expect(getHealthCategory(10)).toBe('CRITICAL');
    expect(getHealthCategory(19)).toBe('CRITICAL');
  });

  it('should handle boundary values correctly', () => {
    expect(getHealthCategory(79.9)).toBe('GOOD');
    expect(getHealthCategory(80)).toBe('EXCELLENT');
    expect(getHealthCategory(59.9)).toBe('FAIR');
    expect(getHealthCategory(60)).toBe('GOOD');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DeviceType Enum Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DeviceType Enum', () => {
  it('should have all required device types', () => {
    expect(DeviceType.MOBILE).toBe('MOBILE');
    expect(DeviceType.TABLET).toBe('TABLET');
    expect(DeviceType.DESKTOP).toBe('DESKTOP');
    expect(DeviceType.UNKNOWN).toBe('UNKNOWN');
  });
});
