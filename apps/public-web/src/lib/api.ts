/**
 * API Client for Public Traceability
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export interface FarmerProfile {
  id: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  region: {
    name: string;
    country: string;
    coordinates: { lat: number; lng: number } | null;
  };
  story: string | null;
  memberSince: string;
  crops: string[];
  certifications: Array<{
    name: string;
    issuedBy: string;
    validUntil: string;
  }>;
  stats: {
    totalBatches: number;
    totalVolume: number;
    avgQualityScore: number | null;
    yearsActive: number;
  };
  badges: Array<{
    type: string;
    label: string;
    earnedAt: string;
  }>;
  recentBatches: Array<{
    id: string;
    shortCode: string;
    product: string;
    harvestDate: string;
    status: string;
  }>;
}

export interface BatchTraceability {
  shortCode: string;
  product: {
    name: string;
    variety: string | null;
    imageUrl: string | null;
    batchId: string;
    harvestDate: string;
    quantity: string;
  };
  farmer: {
    id: string;
    name: string;
    photoUrl: string | null;
    region: string;
    slug: string;
    certifications: string[];
  };
  keyFacts: Array<{
    icon: string;
    label: string;
    value: string;
    highlight?: boolean;
  }>;
  verificationBadge: {
    status: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';
    score: number;
    completedStages: number;
    totalStages: number;
    lastUpdated: string;
  };
  journey: Array<{
    id: string;
    name: string;
    icon: string;
    status: 'completed' | 'current' | 'pending';
    completedAt: string | null;
    details: string | null;
    location: string | null;
  }>;
  transit: {
    status: string;
    origin: string;
    destination: string;
    currentLocation: { lat: number; lng: number } | null;
    estimatedArrival: string | null;
    distanceTraveled: number | null;
    totalDistance: number | null;
  } | null;
  coldChain: {
    status: string;
    avgTemperature: number;
    minTemperature: number;
    maxTemperature: number;
    targetRange: { min: number; max: number };
    excursions: number;
    readings: number;
  } | null;
  sealStatus: {
    isIntact: boolean;
    serialNumber: string;
    verifiedAt: string | null;
    signatureValid: boolean;
  } | null;
  fieldHealth: {
    ndviScore: number | null;
    healthStatus: string;
    lastImageDate: string | null;
    thumbnailUrl: string | null;
  } | null;
  certificate: {
    type: string;
    issuedAt: string;
    isValid: boolean;
    publicUrl: string | null;
    qualityGrade: string | null;
  } | null;
  shareInfo: {
    publicUrl: string;
    qrImageUrl: string | null;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 60, // Cache for 1 minute
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('NOT_FOUND');
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  async getFarmerProfile(idOrSlug: string): Promise<FarmerProfile> {
    return this.fetch<FarmerProfile>(`/public/farmers/${idOrSlug}`);
  }

  async getBatchTraceability(shortCode: string): Promise<BatchTraceability> {
    return this.fetch<BatchTraceability>(`/public/batches/${shortCode}`);
  }

  async recordScan(shortCode: string, referrer?: string): Promise<void> {
    await fetch(`${this.baseUrl}/public/events/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortCode, referrer }),
    });
  }
}

export const api = new ApiClient();
