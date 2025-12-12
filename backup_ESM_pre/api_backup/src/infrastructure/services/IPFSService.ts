
import { IIPFSService } from '../../domain/services/IIPFSService.js';

export class IPFSService implements IIPFSService {
  async uploadFiles(files: { buffer: Buffer, filename: string }[]): Promise<string[]> {
    // Dummy implementation for now
    console.log('Uploading files to IPFS (dummy):', files.map(f => f.filename));
    return Promise.resolve(files.map((_, i) => `ipfs_hash_${i}`));
  }

  async uploadJSON(object: any, name: string): Promise<string> {
    // Dummy implementation for now
    console.log(`Uploading JSON to IPFS (dummy): ${name}`, object);
    return Promise.resolve(`ipfs_hash_json_${name}`);
  }

  async getFileUrl(ipfsHash: string): Promise<string> {
    // Dummy implementation for now
    console.log('Getting IPFS file URL (dummy):', ipfsHash);
    return Promise.resolve(`https://dummy-ipfs.io/ipfs/${ipfsHash}`);
  }

  async pinFile(ipfsHash: string): Promise<void> {
    // Dummy implementation for now
    console.log('Pinning IPFS file (dummy):', ipfsHash);
    return Promise.resolve();
  }
}
