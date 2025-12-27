/**
 * Sentinel Hub API Service
 *
 * Fetches NDVI (Normalized Difference Vegetation Index) data from Sentinel-2 satellites
 * for organic compliance verification.
 *
 * Free Tier: 1,000 Processing Units/month
 * Cost per NDVI request: ~0.5 PU (can do ~2,000 requests/month)
 *
 * @see https://docs.sentinel-hub.com/api/latest/
 * @module SentinelHubService
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import bbox from "@turf/bbox";
import { format, subYears, addDays, differenceInDays } from "date-fns";
import logger from "../../shared/utils/logger.js";
import {
  NDVIDataPoint,
  SatelliteCropType,
  CROP_NDVI_BASELINES,
  VIOLATION_DETECTION_RULES,
  ViolationType,
  ViolationSeverity,
} from "../../domain/entities/SatelliteAnalysis.js";
import { ImagerySource } from "../../domain/entities/FieldImagery.js";

/**
 * GeoJSON Polygon type
 */
interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

/**
 * Configuration for Sentinel Hub service
 */
interface SentinelHubConfig {
  clientId: string;
  clientSecret: string;
  instanceId?: string;
}

/**
 * Raw NDVI data from Sentinel Hub
 */
interface RawNDVIData {
  date: string;
  ndviMean: number;
  ndviStd: number;
  ndviMin: number;
  ndviMax: number;
  cloudCoverage: number;
  validPixelPercent: number;
}

/**
 * Sentinel Hub API Service
 * Provides satellite imagery analysis for organic compliance verification
 */
export class SentinelHubService {
  private api: AxiosInstance;
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private requestCount: number = 0;

  constructor(private config: SentinelHubConfig) {
    this.api = axios.create({
      baseURL: "https://services.sentinel-hub.com",
      timeout: 60000, // 60 seconds for large requests
    });
  }

  /**
   * Authenticate with Sentinel Hub OAuth2
   * Token is valid for 1 hour
   */
  private async authenticate(): Promise<string> {
    // Reuse token if still valid (with 5 min buffer)
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      new Date() < new Date(this.tokenExpiresAt.getTime() - 5 * 60 * 1000)
    ) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        "https://services.sentinel-hub.com/oauth/token",
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10000,
        },
      );

      this.accessToken = response.data.access_token as string;
      this.tokenExpiresAt = new Date(
        Date.now() + response.data.expires_in * 1000,
      );

      logger.debug("[SentinelHub] Authentication successful", {
        expiresIn: response.data.expires_in,
      });

      return this.accessToken;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error("[SentinelHub] Authentication failed", {
        status: axiosError.response?.status,
        message: axiosError.message,
      });
      throw new Error(
        `Sentinel Hub authentication failed: ${axiosError.message}`,
      );
    }
  }

  /**
   * Check if Sentinel Hub is configured and available
   */
  isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Get current request count for quota tracking
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Get NDVI time series for a field polygon
   *
   * @param gpsCoordinates - GeoJSON Polygon of field boundary
   * @param startDate - Analysis start (typically 3 years ago)
   * @param endDate - Analysis end (typically today)
   * @param cropType - Crop type for baseline calibration
   * @param intervalDays - Data point frequency (default: 30 days)
   * @param maxCloudCoverage - Max cloud coverage filter (default: 50%)
   */
  async getNDVITimeSeries(
    gpsCoordinates: GeoJsonPolygon,
    startDate: Date,
    endDate: Date,
    cropType: SatelliteCropType,
    intervalDays: number = 30,
    maxCloudCoverage: number = 50,
  ): Promise<NDVIDataPoint[]> {
    if (!this.isConfigured()) {
      logger.warn("[SentinelHub] Not configured, returning mock data");
      return this.generateMockNDVIData(
        startDate,
        endDate,
        cropType,
        intervalDays,
      );
    }

    const token = await this.authenticate();

    // Calculate bounding box from polygon
    const [minLng, minLat, maxLng, maxLat] = bbox({
      type: "Feature",
      geometry: gpsCoordinates,
      properties: {},
    });

    // Evalscript: Calculates NDVI from Sentinel-2 bands
    const evalscript = this.getNDVIEvalscript();

    const dataPoints: NDVIDataPoint[] = [];
    let currentDate = new Date(startDate);

    // Fetch data in time windows to avoid large requests
    while (currentDate <= endDate) {
      const windowEnd = addDays(currentDate, intervalDays);

      try {
        const rawData = await this.fetchNDVIForWindow(
          token,
          [minLng, minLat, maxLng, maxLat],
          currentDate,
          windowEnd > endDate ? endDate : windowEnd,
          evalscript,
          maxCloudCoverage,
        );

        if (rawData && rawData.validPixelPercent > 50) {
          const dataPoint = this.convertToNDVIDataPoint(
            rawData,
            dataPoints,
            cropType,
          );
          dataPoints.push(dataPoint);
        }

        this.requestCount++;
      } catch (error) {
        logger.warn("[SentinelHub] Failed to fetch data for window", {
          date: format(currentDate, "yyyy-MM-dd"),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      currentDate = addDays(currentDate, intervalDays);
    }

    logger.info("[SentinelHub] NDVI time series fetched", {
      dataPoints: dataPoints.length,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
      requestCount: this.requestCount,
    });

    return dataPoints;
  }

  /**
   * Fetch NDVI data for a specific time window
   */
  private async fetchNDVIForWindow(
    token: string,
    bbox: number[],
    startDate: Date,
    endDate: Date,
    evalscript: string,
    maxCloudCoverage: number,
  ): Promise<RawNDVIData | null> {
    const requestBody = {
      input: {
        bounds: {
          bbox,
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
        },
        data: [
          {
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: {
                from: format(startDate, "yyyy-MM-dd'T'00:00:00'Z'"),
                to: format(endDate, "yyyy-MM-dd'T'23:59:59'Z'"),
              },
              maxCloudCoverage,
              mosaickingOrder: "leastCC", // Least cloud coverage first
            },
          },
        ],
      },
      output: {
        width: 256,
        height: 256,
        responses: [
          {
            identifier: "default",
            format: { type: "application/json" },
          },
        ],
      },
      evalscript,
    };

    try {
      const response = await this.api.post("/api/v1/statistics", requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Parse statistical response
      const stats =
        response.data?.data?.[0]?.outputs?.default?.bands?.B0?.stats;

      if (!stats) {
        return null;
      }

      return {
        date: format(startDate, "yyyy-MM-dd"),
        ndviMean: stats.mean || 0,
        ndviStd: stats.stDev || 0,
        ndviMin: stats.min || 0,
        ndviMax: stats.max || 0,
        cloudCoverage: response.data?.data?.[0]?.outputs?.dataMask?.bands?.B0
          ?.stats?.mean
          ? (1 - response.data.data[0].outputs.dataMask.bands.B0.stats.mean) *
            100
          : 0,
        validPixelPercent: stats.sampleCount > 0 ? 100 : 0,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 429) {
        throw new Error(
          "Sentinel Hub quota exceeded. Wait until next month or upgrade plan.",
        );
      }

      throw error;
    }
  }

  /**
   * Get NDVI calculation evalscript
   */
  private getNDVIEvalscript(): string {
    return `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08", "SCL", "dataMask"],
      units: "DN"
    }],
    output: [
      { id: "default", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}

function evaluatePixel(sample) {
  // Calculate NDVI = (NIR - Red) / (NIR + Red)
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);

  // Filter out clouds/shadows/snow (SCL classification)
  // SCL values: 3=cloud shadow, 8=cloud medium, 9=cloud high, 10=thin cirrus, 11=snow
  let isValid = sample.dataMask == 1 &&
                sample.SCL != 3 &&
                sample.SCL != 8 &&
                sample.SCL != 9 &&
                sample.SCL != 10 &&
                sample.SCL != 11;

  return {
    default: [isValid ? ndvi : NaN],
    dataMask: [isValid ? 1 : 0]
  };
}
    `.trim();
  }

  /**
   * Convert raw data to NDVIDataPoint with violation detection
   */
  private convertToNDVIDataPoint(
    raw: RawNDVIData,
    previousPoints: NDVIDataPoint[],
    cropType: SatelliteCropType,
  ): NDVIDataPoint {
    const baseline = CROP_NDVI_BASELINES[cropType];
    const previousNDVI =
      previousPoints.length > 0
        ? previousPoints[previousPoints.length - 1].ndviAverage
        : null;

    // Detect synthetic fertilizer
    const syntheticDetected = this.detectSyntheticFertilizer(
      raw.ndviMean,
      previousNDVI,
      baseline.syntheticThreshold,
    );

    // Calculate anomaly score
    const anomalyScore = this.calculateAnomalyScore(
      raw.ndviMean,
      baseline.healthyNdviMin,
      baseline.healthyNdviMax,
      previousNDVI,
    );

    // Calculate confidence based on data quality
    const confidence = Math.max(
      0.5,
      1 - (raw.cloudCoverage / 100) * 0.3 - (raw.ndviStd > 0.2 ? 0.2 : 0),
    );

    return {
      date: raw.date,
      ndviAverage: Number(raw.ndviMean.toFixed(4)),
      ndviStdDev: Number(raw.ndviStd.toFixed(4)),
      ndviMin: Number(raw.ndviMin.toFixed(4)),
      ndviMax: Number(raw.ndviMax.toFixed(4)),
      cloudCoverage: Number(raw.cloudCoverage.toFixed(1)),
      syntheticFertilizerDetected: syntheticDetected,
      confidence: Number(confidence.toFixed(2)),
      anomalyScore: Math.round(anomalyScore),
      source: ImagerySource.SENTINEL_2,
    };
  }

  /**
   * Detect synthetic fertilizer from NDVI spike
   * Pattern: Sudden NDVI increase >threshold within 30 days
   */
  private detectSyntheticFertilizer(
    currentNDVI: number,
    previousNDVI: number | null,
    threshold: number,
  ): boolean {
    if (previousNDVI === null) return false;

    const delta = currentNDVI - previousNDVI;
    return delta > threshold;
  }

  /**
   * Calculate anomaly score (0-100)
   */
  private calculateAnomalyScore(
    ndvi: number,
    healthyMin: number,
    healthyMax: number,
    previousNDVI: number | null,
  ): number {
    let score = 0;

    // Out of healthy range
    if (ndvi < healthyMin) {
      score += (healthyMin - ndvi) * 100;
    } else if (ndvi > healthyMax) {
      score += (ndvi - healthyMax) * 50; // Less penalty for high NDVI
    }

    // Large change from previous
    if (previousNDVI !== null) {
      const delta = Math.abs(ndvi - previousNDVI);
      if (delta > 0.15) {
        score += delta * 100;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Generate mock NDVI data for testing/development
   * Simulates seasonal patterns for Michoacán avocado fields
   */
  private generateMockNDVIData(
    startDate: Date,
    endDate: Date,
    cropType: SatelliteCropType,
    intervalDays: number,
  ): NDVIDataPoint[] {
    const baseline = CROP_NDVI_BASELINES[cropType];
    const dataPoints: NDVIDataPoint[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const month = currentDate.getMonth();
      const isPeakMonth = baseline.peakMonths.includes(month);
      const isLowMonth = baseline.lowMonths.includes(month);

      // Base NDVI with seasonal variation
      let baseNDVI: number;
      if (isPeakMonth) {
        baseNDVI = baseline.healthyNdviMax - 0.1;
      } else if (isLowMonth) {
        baseNDVI = baseline.healthyNdviMin + 0.1;
      } else {
        baseNDVI = (baseline.healthyNdviMin + baseline.healthyNdviMax) / 2;
      }

      // Add realistic noise
      const noise = (Math.random() - 0.5) * 0.08;
      const ndvi = Math.max(0.1, Math.min(0.95, baseNDVI + noise));

      const previousNDVI =
        dataPoints.length > 0
          ? dataPoints[dataPoints.length - 1].ndviAverage
          : null;

      dataPoints.push({
        date: format(currentDate, "yyyy-MM-dd"),
        ndviAverage: Number(ndvi.toFixed(4)),
        ndviStdDev: Number((0.03 + Math.random() * 0.05).toFixed(4)),
        ndviMin: Number((ndvi - 0.1).toFixed(4)),
        ndviMax: Number((ndvi + 0.1).toFixed(4)),
        cloudCoverage: Number((Math.random() * 30).toFixed(1)),
        syntheticFertilizerDetected: false, // Clean mock data
        confidence: 0.92,
        anomalyScore: Math.round(Math.random() * 10),
        source: ImagerySource.SENTINEL_2,
      });

      currentDate = addDays(currentDate, intervalDays);
    }

    logger.info("[SentinelHub] Generated mock NDVI data", {
      dataPoints: dataPoints.length,
      cropType,
    });

    return dataPoints;
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "Sentinel Hub credentials not configured",
      };
    }

    try {
      await this.authenticate();
      return {
        success: true,
        message: "Sentinel Hub connection successful",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Create Sentinel Hub service instance from environment variables
 */
export function createSentinelHubService(): SentinelHubService {
  return new SentinelHubService({
    clientId: process.env.SENTINEL_HUB_CLIENT_ID || "",
    clientSecret: process.env.SENTINEL_HUB_CLIENT_SECRET || "",
    instanceId: process.env.SENTINEL_HUB_INSTANCE_ID,
  });
}
