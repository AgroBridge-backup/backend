/**
 * IPFS Service using Pinata
 * Uploads certificate metadata to IPFS for decentralized storage
 * Non-blocking: Certificate generation continues even if IPFS fails
 */

import { CertificateIpfsMetadata, IPFS_GATEWAYS } from '../../domain/entities/OrganicCertificate.js';
import logger from '../../shared/utils/logger.js';

/**
 * IPFS Service configuration
 */
interface IpfsServiceConfig {
  pinataApiKey: string;
  pinataSecretKey: string;
  gateway?: keyof typeof IPFS_GATEWAYS;
}

/**
 * Pinata pin response
 */
interface PinataPinResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

/**
 * IPFS Service for certificate metadata storage
 */
export class IpfsService {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly gateway: string;
  private readonly pinataApiUrl = 'https://api.pinata.cloud';

  constructor(config: IpfsServiceConfig) {
    this.apiKey = config.pinataApiKey;
    this.secretKey = config.pinataSecretKey;
    this.gateway = IPFS_GATEWAYS[config.gateway || 'pinata'];
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }

  /**
   * Upload certificate metadata to IPFS via Pinata
   * Returns IPFS CID (Content Identifier) or null if failed
   */
  async uploadCertificateMetadata(
    certificateNumber: string,
    metadata: CertificateIpfsMetadata
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      logger.warn('IPFS service not configured, skipping upload', { certificateNumber });
      return null;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.pinataApiUrl}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.secretKey,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `certificate-${certificateNumber}`,
            keyvalues: {
              certificateNumber,
              cropType: metadata.cropType,
              issuedDate: metadata.issuedDate,
              farmerId: metadata.farmer.id,
            },
          },
          pinataOptions: {
            cidVersion: 1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata API error: ${response.status} - ${errorText}`);
      }

      const result: PinataPinResponse = await response.json();
      const duration = Date.now() - startTime;

      logger.info('Certificate metadata uploaded to IPFS', {
        certificateNumber,
        ipfsHash: result.IpfsHash,
        pinSize: result.PinSize,
        duration,
      });

      return result.IpfsHash;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error('IPFS upload failed', {
        certificateNumber,
        error: error.message,
        duration,
        retryable: true,
      });

      // Non-blocking: Return null instead of throwing
      return null;
    }
  }

  /**
   * Get gateway URL for IPFS hash
   */
  getGatewayUrl(ipfsHash: string): string {
    return `${this.gateway}${ipfsHash}`;
  }

  /**
   * Verify that content is pinned
   */
  async isPinned(ipfsHash: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.pinataApiUrl}/pinning/pinJobs?ipfs_pin_hash=${ipfsHash}`, {
        method: 'GET',
        headers: {
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.secretKey,
        },
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.rows?.length > 0;
    } catch (error: any) {
      logger.warn('Failed to verify IPFS pin status', { ipfsHash, error: error.message });
      return false;
    }
  }

  /**
   * Test Pinata API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.pinataApiUrl}/data/testAuthentication`, {
        method: 'GET',
        headers: {
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.secretKey,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create IPFS service from environment variables
 */
export function createIpfsService(): IpfsService {
  return new IpfsService({
    pinataApiKey: process.env.PINATA_API_KEY || '',
    pinataSecretKey: process.env.PINATA_SECRET_KEY || '',
    gateway: (process.env.IPFS_GATEWAY as keyof typeof IPFS_GATEWAYS) || 'pinata',
  });
}
