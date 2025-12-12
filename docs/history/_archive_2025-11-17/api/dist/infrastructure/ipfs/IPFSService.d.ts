import { IIPFSService } from '@/domain/services/IIPFSService';
interface PinataConfig {
    apiKey: string;
    apiSecret: string;
    gatewayUrl: string;
}
export declare class IPFSService implements IIPFSService {
    private config;
    private readonly client;
    private readonly gatewayUrl;
    constructor(config: PinataConfig);
    uploadFiles(files: {
        buffer: Buffer;
        filename: string;
    }[]): Promise<string[]>;
    private uploadSingleFile;
    uploadJSON(object: any, name: string): Promise<string>;
    getFileUrl(ipfsHash: string): Promise<string>;
    pinFile(ipfsHash: string): Promise<void>;
}
export {};
//# sourceMappingURL=IPFSService.d.ts.map