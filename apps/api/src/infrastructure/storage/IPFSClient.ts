/**
 * @file IPFSClient
 * @description Resilient IPFS client with retry logic and multiple provider fallback
 *
 * Provides:
 * - Automatic retry with exponential backoff
 * - Multiple IPFS provider fallback (Pinata, Infura, NFT.Storage)
 * - Circuit breaker pattern to prevent cascade failures
 * - Upload verification and pinning
 */

import { captureException, addBreadcrumb, instrumentDatabase } from '../monitoring/sentry.js';

export interface IPFSProvider {
  name: string;
  uploadUrl: string;
  gatewayUrl: string;
  apiKey?: string;
  secretKey?: string;
  headers: () => Record<string, string>;
  priority: number;
  isHealthy: boolean;
  failureCount: number;
  lastFailure?: Date;
}

export interface UploadResult {
  cid: string;
  provider: string;
  size: number;
  url: string;
}

export interface IPFSClientConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  timeoutMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

const DEFAULT_CONFIG: IPFSClientConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  timeoutMs: 60000,
  circuitBreakerThreshold: 3,
  circuitBreakerResetMs: 60000,
};

export class IPFSClient {
  private providers: IPFSProvider[] = [];
  private config: IPFSClientConfig;

  constructor(config: Partial<IPFSClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  /**
   * Initialize IPFS providers from environment
   */
  private initializeProviders(): void {
    // Pinata (primary)
    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
      this.providers.push({
        name: 'pinata',
        uploadUrl: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
        gatewayUrl: 'https://gateway.pinata.cloud/ipfs',
        apiKey: process.env.PINATA_API_KEY,
        secretKey: process.env.PINATA_SECRET_KEY,
        headers: () => ({
          'pinata_api_key': process.env.PINATA_API_KEY!,
          'pinata_secret_api_key': process.env.PINATA_SECRET_KEY!,
        }),
        priority: 1,
        isHealthy: true,
        failureCount: 0,
      });
    }

    // Infura (secondary)
    if (process.env.INFURA_IPFS_PROJECT_ID && process.env.INFURA_IPFS_SECRET) {
      const auth = Buffer.from(
        `${process.env.INFURA_IPFS_PROJECT_ID}:${process.env.INFURA_IPFS_SECRET}`
      ).toString('base64');

      this.providers.push({
        name: 'infura',
        uploadUrl: 'https://ipfs.infura.io:5001/api/v0/add',
        gatewayUrl: 'https://ipfs.infura.io/ipfs',
        headers: () => ({
          'Authorization': `Basic ${auth}`,
        }),
        priority: 2,
        isHealthy: true,
        failureCount: 0,
      });
    }

    // NFT.Storage (tertiary)
    if (process.env.NFT_STORAGE_API_KEY) {
      this.providers.push({
        name: 'nft.storage',
        uploadUrl: 'https://api.nft.storage/upload',
        gatewayUrl: 'https://nftstorage.link/ipfs',
        apiKey: process.env.NFT_STORAGE_API_KEY,
        headers: () => ({
          'Authorization': `Bearer ${process.env.NFT_STORAGE_API_KEY}`,
        }),
        priority: 3,
        isHealthy: true,
        failureCount: 0,
      });
    }

    // Cloudflare IPFS (read-only fallback gateway)
    this.providers.push({
      name: 'cloudflare',
      uploadUrl: '', // Read-only
      gatewayUrl: 'https://cloudflare-ipfs.com/ipfs',
      headers: () => ({}),
      priority: 99,
      isHealthy: true,
      failureCount: 0,
    });

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);

    addBreadcrumb('IPFS providers initialized', 'storage', {
      providers: this.providers.map(p => p.name),
    });
  }

  /**
   * Upload file to IPFS with retry and fallback
   */
  async upload(
    content: Buffer | Blob | string,
    filename: string,
    metadata?: Record<string, unknown>
  ): Promise<UploadResult> {
    return instrumentDatabase('ipfs_upload', async () => {
      const availableProviders = this.getAvailableProviders();

      if (availableProviders.length === 0) {
        throw new Error('No IPFS providers available');
      }

      let lastError: Error | null = null;

      for (const provider of availableProviders) {
        try {
          const result = await this.uploadToProvider(provider, content, filename, metadata);

          // Reset failure count on success
          provider.failureCount = 0;
          provider.isHealthy = true;

          addBreadcrumb('IPFS upload successful', 'storage', {
            provider: provider.name,
            cid: result.cid,
          });

          return result;
        } catch (error) {
          lastError = error as Error;
          this.handleProviderFailure(provider, error as Error);

          addBreadcrumb('IPFS provider failed, trying next', 'storage', {
            provider: provider.name,
            error: (error as Error).message,
          });
        }
      }

      captureException(lastError!, { filename, providers: availableProviders.map(p => p.name) });
      throw new Error(`All IPFS providers failed: ${lastError?.message}`);
    });
  }

  /**
   * Upload to specific provider with retry
   */
  private async uploadToProvider(
    provider: IPFSProvider,
    content: Buffer | Blob | string,
    filename: string,
    metadata?: Record<string, unknown>
  ): Promise<UploadResult> {
    if (!provider.uploadUrl) {
      throw new Error(`Provider ${provider.name} does not support uploads`);
    }

    let lastError: Error | null = null;
    let delay = this.config.retryDelayMs;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeUpload(provider, content, filename, metadata);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          await this.sleep(delay);
          delay = Math.min(delay * 2, this.config.maxRetryDelayMs);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute actual upload to provider
   */
  private async executeUpload(
    provider: IPFSProvider,
    content: Buffer | Blob | string,
    filename: string,
    metadata?: Record<string, unknown>
  ): Promise<UploadResult> {
    const formData = new FormData();

    // Handle different content types
    let blob: Blob;
    if (Buffer.isBuffer(content)) {
      blob = new Blob([content]);
    } else if (typeof content === 'string') {
      blob = new Blob([content], { type: 'text/plain' });
    } else {
      blob = content;
    }

    formData.append('file', blob, filename);

    // Add metadata for Pinata
    if (provider.name === 'pinata' && metadata) {
      formData.append('pinataMetadata', JSON.stringify({
        name: filename,
        keyvalues: metadata,
      }));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(provider.uploadUrl, {
        method: 'POST',
        headers: provider.headers(),
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Parse CID from different provider responses
      let cid: string;
      let size: number;

      switch (provider.name) {
        case 'pinata':
          cid = result.IpfsHash;
          size = result.PinSize;
          break;
        case 'infura':
          cid = result.Hash;
          size = parseInt(result.Size, 10);
          break;
        case 'nft.storage':
          cid = result.value?.cid || result.cid;
          size = blob.size;
          break;
        default:
          cid = result.cid || result.Hash || result.IpfsHash;
          size = blob.size;
      }

      return {
        cid,
        provider: provider.name,
        size,
        url: `${provider.gatewayUrl}/${cid}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Retrieve file from IPFS
   */
  async retrieve(cid: string): Promise<Buffer> {
    return instrumentDatabase('ipfs_retrieve', async () => {
      const availableProviders = this.providers.filter(p => p.isHealthy);

      for (const provider of availableProviders) {
        try {
          const response = await fetch(`${provider.gatewayUrl}/${cid}`, {
            signal: AbortSignal.timeout(this.config.timeoutMs),
          });

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
          }
        } catch (error) {
          addBreadcrumb('IPFS retrieve failed', 'storage', {
            provider: provider.name,
            cid,
            error: (error as Error).message,
          });
        }
      }

      throw new Error(`Failed to retrieve CID: ${cid}`);
    });
  }

  /**
   * Check if CID exists and is pinned
   */
  async verify(cid: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://cloudflare-ipfs.com/ipfs/${cid}`,
        { method: 'HEAD', signal: AbortSignal.timeout(10000) }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Handle provider failure (circuit breaker)
   */
  private handleProviderFailure(provider: IPFSProvider, error: Error): void {
    provider.failureCount++;
    provider.lastFailure = new Date();

    if (provider.failureCount >= this.config.circuitBreakerThreshold) {
      provider.isHealthy = false;

      // Schedule circuit breaker reset
      setTimeout(() => {
        provider.isHealthy = true;
        provider.failureCount = 0;
        addBreadcrumb('IPFS provider circuit breaker reset', 'storage', {
          provider: provider.name,
        });
      }, this.config.circuitBreakerResetMs);

      addBreadcrumb('IPFS provider circuit breaker tripped', 'storage', {
        provider: provider.name,
        failureCount: provider.failureCount,
      });
    }
  }

  /**
   * Get available providers (healthy and with upload support)
   */
  private getAvailableProviders(): IPFSProvider[] {
    return this.providers.filter(p => p.isHealthy && p.uploadUrl);
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Array<{
    name: string;
    isHealthy: boolean;
    failureCount: number;
    lastFailure?: Date;
  }> {
    return this.providers.map(p => ({
      name: p.name,
      isHealthy: p.isHealthy,
      failureCount: p.failureCount,
      lastFailure: p.lastFailure,
    }));
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const provider of this.providers) {
      provider.isHealthy = true;
      provider.failureCount = 0;
      provider.lastFailure = undefined;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let ipfsClientInstance: IPFSClient | null = null;

export function getIPFSClient(config?: Partial<IPFSClientConfig>): IPFSClient {
  if (!ipfsClientInstance) {
    ipfsClientInstance = new IPFSClient(config);
  }
  return ipfsClientInstance;
}

export function resetIPFSClient(): void {
  ipfsClientInstance = null;
}
