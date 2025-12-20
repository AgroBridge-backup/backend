export interface IIPFSService {
  uploadFiles(files: { buffer: Buffer, filename: string }[]): Promise<string[]>;
  uploadJSON(object: any, name: string): Promise<string>;
  getFileUrl(ipfsHash: string): Promise<string>;
  pinFile(ipfsHash: string): Promise<void>;
}