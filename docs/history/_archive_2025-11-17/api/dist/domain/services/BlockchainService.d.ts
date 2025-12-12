interface BlockchainConfig {
    rpcUrl: string;
    chainId: number;
    privateKey: string;
    contracts: {
        traceabilityRegistry: string;
        producerCertification: string;
        batchToken: string;
    };
}
interface RegisterEventParams {
    eventType: string;
    batchId: string;
    latitude: number;
    longitude: number;
    ipfsHash: string;
}
export declare class BlockchainService {
    private config;
    private provider;
    private wallet;
    private traceabilityContract;
    private producerCertContract;
    private batchTokenContract;
    private readonly MAX_RETRIES;
    private readonly RETRY_DELAY_MS;
    private readonly GAS_LIMIT_BUFFER;
    constructor(config: BlockchainConfig);
    private initializeProvider;
    private initializeWallet;
    private initializeContracts;
    /**
     * Register event on blockchain with retry mechanism
     */
    registerEventOnChain(params: RegisterEventParams): Promise<{
        eventId: string;
        txHash: string;
        gasUsed: string;
    }>;
    /**
     * Get batch history from blockchain (with fallback to cache)
     */
    getBatchHistoryFromChain(batchId: string): Promise<any[]>;
    /**
     * Whitelist producer on blockchain
     */
    whitelistProducerOnChain(params: {
        walletAddress: string;
        businessName: string;
        rfc: string;
        state: string;
        municipality: string;
        latitude: number;
        longitude: number;
    }): Promise<{
        txHash: string;
    }>;
    /**
     * Mint NFT for batch
     */
    mintBatchNFT(params: {
        producerAddress: string;
        batchNumber: string;
        ipfsMetadataHash: string;
    }): Promise<{
        tokenId: string;
        txHash: string;
    }>;
    /**
     * Execute function with retry mechanism (exponential backoff)
     */
    private executeWithRetry;
    /**
     * Listen to blockchain events and sync to database
     */
    startEventListener(callback: (event: any) => Promise<void>): void;
    /**
     * Health check
     */
    isHealthy(): Promise<boolean>;
}
export {};
//# sourceMappingURL=BlockchainService.d.ts.map