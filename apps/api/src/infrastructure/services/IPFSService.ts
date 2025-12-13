import logger from '../../shared/utils/logger.js';

export class IPFSService {
  async uploadFiles(files: any[]): Promise<string[]> {
    logger.info({ message: 'Uploading files to IPFS (dummy)', meta: { files: files.map(f => f.filename) } });
    return files.map((f, i) => `QmHash${i}`);
  }

  async uploadJSON(name: string, object: any): Promise<string> {
    logger.info({ message: `Uploading JSON to IPFS (dummy): ${name}`, meta: { object } });
    return `QmJSONHash${name}`;
  }

  getGatewayUrl(ipfsHash: string): string {
    logger.info({ message: 'Getting IPFS file URL (dummy)', meta: { ipfsHash } });
    return `https://ipfs.io/ipfs/${ipfsHash}`;
  }

  async pinFile(ipfsHash: string): Promise<void> {
    logger.info({ message: 'Pinning IPFS file (dummy)', meta: { ipfsHash } });
  }
}
