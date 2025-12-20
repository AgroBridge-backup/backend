import axios from 'axios';
import FormData from 'form-data';
import { IIPFSService } from '../../domain/services/IIPFSService.js';
import { AppError } from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

interface PinataConfig {
  apiKey: string;
  apiSecret: string;
  gatewayUrl: string;
}

export class IPFSService implements IIPFSService {
  private readonly client;
  private readonly gatewayUrl: string;

  constructor(private config: PinataConfig) {
    this.client = axios.create({
      baseURL: 'https://api.pinata.cloud',
      headers: {
        'pinata_api_key': this.config.apiKey,
        'pinata_secret_api_key': this.config.apiSecret,
      },
    });
    this.gatewayUrl = config.gatewayUrl;
  }

  async uploadFiles(files: { buffer: Buffer, filename: string }[]): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadSingleFile(file.buffer, file.filename));
    return Promise.all(uploadPromises);
  }

  private async uploadSingleFile(buffer: Buffer, filename: string): Promise<string> {
    try {
      const form = new FormData();
      form.append('file', buffer, { filename });

      const response = await this.client.post('/pinning/pinFileToIPFS', form, {
        headers: {
          ...form.getHeaders(),
        },
      });

      const ipfsHash = response.data.IpfsHash;
      logger.info(`File uploaded to IPFS`, { ipfsHash, filename });
      return `ipfs://${ipfsHash}`;
    } catch (error: any) {
      logger.error('Failed to upload file to Pinata', { error: error.message, filename });
      throw new AppError(`Failed to upload file ${filename} to IPFS`, 500);
    }
  }


  async uploadJSON(object: any, name: string): Promise<string> {
    try {
      const response = await this.client.post('/pinning/pinJSONToIPFS', {
        pinataMetadata: { name },
        pinataContent: object,
      });

      const ipfsHash = response.data.IpfsHash;
      logger.info(`JSON metadata uploaded to IPFS`, { ipfsHash, name });
      return ipfsHash;
    } catch (error: any) {
      logger.error('Failed to upload JSON to Pinata', { error: error.message });
      throw new AppError('Failed to upload metadata to IPFS', 500);
    }
  }

  getFileUrl(ipfsHash: string): Promise<string> {
    if (ipfsHash.startsWith('ipfs://')) {
      ipfsHash = ipfsHash.substring(7);
    }
    return Promise.resolve(`${this.gatewayUrl}/ipfs/${ipfsHash}`);
  }

  async pinFile(ipfsHash: string): Promise<void> {
    try {
      await this.client.post(`/pinning/pinByHash`, {
        hashToPin: ipfsHash,
      });
      logger.info(`File pinned successfully`, { ipfsHash });
    } catch (error: any) {
      logger.error('Failed to pin file on Pinata', { error: error.message });
      // Non-critical, just log it
    }
  }
}