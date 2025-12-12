export interface IIPFSService {
  uploadFiles(files: { buffer: Buffer, filename: string }[]): Promise<string[]>; // Returns array of ipfs://hash
  uploadJSON(object: any, name: string): Promise<string>;
  getFileUrl(ipfsHash: string): Promise<string>; // Gateway URL
  pinFile(ipfsHash: string): Promise<void>; // Ensure persistence
}
