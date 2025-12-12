import axios from 'axios';
import FormData from 'form-data';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/utils/logger';
export class IPFSService {
    config;
    client;
    gatewayUrl;
    constructor(config) {
        this.config = config;
        this.client = axios.create({
            baseURL: 'https://api.pinata.cloud',
            headers: {
                'pinata_api_key': this.config.apiKey,
                'pinata_secret_api_key': this.config.apiSecret,
            },
        });
        this.gatewayUrl = config.gatewayUrl;
    }
    async uploadFiles(files) {
        const uploadPromises = files.map(file => this.uploadSingleFile(file.buffer, file.filename));
        return Promise.all(uploadPromises);
    }
    async uploadSingleFile(buffer, filename) {
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
        }
        catch (error) {
            logger.error('Failed to upload file to Pinata', { error: error.message, filename });
            throw new AppError(`Failed to upload file ${filename} to IPFS`, 500);
        }
    }
    async uploadJSON(object, name) {
        try {
            const response = await this.client.post('/pinning/pinJSONToIPFS', {
                pinataMetadata: { name },
                pinataContent: object,
            });
            const ipfsHash = response.data.IpfsHash;
            logger.info(`JSON metadata uploaded to IPFS`, { ipfsHash, name });
            return ipfsHash;
        }
        catch (error) {
            logger.error('Failed to upload JSON to Pinata', { error: error.message });
            throw new AppError('Failed to upload metadata to IPFS', 500);
        }
    }
    getFileUrl(ipfsHash) {
        if (ipfsHash.startsWith('ipfs://')) {
            ipfsHash = ipfsHash.substring(7);
        }
        return Promise.resolve(`${this.gatewayUrl}/ipfs/${ipfsHash}`);
    }
    async pinFile(ipfsHash) {
        try {
            await this.client.post(`/pinning/pinByHash`, {
                hashToPin: ipfsHash,
            });
            logger.info(`File pinned successfully`, { ipfsHash });
        }
        catch (error) {
            logger.error('Failed to pin file on Pinata', { error: error.message });
            // Non-critical, just log it
        }
    }
}
//# sourceMappingURL=IPFSService.js.map