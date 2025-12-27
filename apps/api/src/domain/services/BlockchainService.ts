import { ethers } from "ethers";
import { AppError } from "../../shared/errors/AppError.js";
import logger from "../../shared/utils/logger.js";
import {
  instrumentBlockchain,
  addBreadcrumb,
  captureException,
} from "../../infrastructure/monitoring/sentry.js";

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

export class BlockchainService {
  private provider!: ethers.providers.JsonRpcProvider;
  private wallet!: ethers.Wallet;
  private traceabilityContract!: ethers.Contract;
  private producerCertContract!: ethers.Contract;
  private batchTokenContract!: ethers.Contract;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly GAS_LIMIT_BUFFER = 1.2; // 20% buffer
  // FIXED: L-019 - Extract magic number to constant for network confirmation requirement
  private readonly REQUIRED_CONFIRMATIONS = 1; // Minimum confirmations before tx is considered final

  constructor(private config: BlockchainConfig) {
    this.initializeProvider();
    this.initializeWallet();
    this.initializeContracts();
  }

  private initializeProvider(): void {
    try {
      this.provider = new ethers.providers.JsonRpcProvider(
        this.config.rpcUrl,
        this.config.chainId,
      );
      logger.info("Blockchain provider initialized", {
        chainId: this.config.chainId,
        rpcUrl: this.config.rpcUrl.substring(0, 30) + "...",
      });
    } catch (error) {
      logger.error("Failed to initialize blockchain provider", { error });
      throw new AppError("Blockchain connection failed", 500);
    }
  }

  private initializeWallet(): void {
    try {
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
      logger.info("Wallet initialized", {
        address: this.wallet.address,
      });
    } catch (error) {
      logger.error("Failed to initialize wallet", { error });
      throw new AppError("Wallet initialization failed", 500);
    }
  }

  private initializeContracts(): void {
    const traceabilityABI = [
      "function registerEvent(string eventType, string batchId, int256 latitude, int256 longitude, string ipfsHash) returns (bytes32)",
      "function getBatchHistory(string batchId) view returns (tuple(bytes32 eventId, string eventType, address producer, string batchId, uint256 timestamp, tuple(int256 latitude, int256 longitude) location, string ipfsHash, bytes32 previousEventHash, bool verified)[])",
      "function verifyEvent(bytes32 eventId)",
      "event EventRegistered(bytes32 indexed eventId, string indexed batchId, address indexed producer, string eventType, uint256 timestamp, string ipfsHash)",
    ];
    const producerCertABI = [
      "function whitelistProducer(address producerWallet, string businessName, string rfc, string state, string municipality, int256 latitude, int256 longitude)",
      "function producers(address) view returns (tuple(address wallet, string businessName, string rfc, string state, string municipality, int256 latitude, int256 longitude, bool isWhitelisted, uint256 whitelistedAt, uint256 totalBatches))",
    ];

    const batchTokenABI = [
      "function mintBatch(address to, string batchNumber, string tokenURI) returns (uint256)",
      "function getTokenIdByBatch(string batchNumber) view returns (uint256)",
      "event BatchMinted(uint256 indexed tokenId, string indexed batchNumber, address indexed to)",
    ];

    this.traceabilityContract = new ethers.Contract(
      this.config.contracts.traceabilityRegistry,
      traceabilityABI,
      this.wallet,
    );

    this.producerCertContract = new ethers.Contract(
      this.config.contracts.producerCertification,
      producerCertABI,
      this.wallet,
    );

    this.batchTokenContract = new ethers.Contract(
      this.config.contracts.batchToken,
      batchTokenABI,
      this.wallet,
    );

    logger.info("Smart contracts initialized", {
      traceabilityRegistry: this.config.contracts.traceabilityRegistry,
      producerCertification: this.config.contracts.producerCertification,
      batchToken: this.config.contracts.batchToken,
    });
  }

  /**
   * Register event on blockchain with retry mechanism
   */
  async registerEventOnChain(params: RegisterEventParams): Promise<{
    eventId: string;
    txHash: string;
    gasUsed: string;
  }> {
    addBreadcrumb("Blockchain operation started", "blockchain", {
      operation: "registerEvent",
      batchId: params.batchId,
    });

    return instrumentBlockchain("registerEventOnChain", () =>
      this.executeWithRetry(async () => {
        try {
          // Convert coordinates to blockchain format (multiply by 1e6)
          const latitudeScaled = Math.round(params.latitude * 1_000_000);
          const longitudeScaled = Math.round(params.longitude * 1_000_000);

          // Estimate gas with buffer
          const estimatedGas =
            await this.traceabilityContract.registerEvent.estimateGas(
              params.eventType,
              params.batchId,
              latitudeScaled,
              longitudeScaled,
              params.ipfsHash,
            );
          const gasLimit = Math.ceil(
            Number(estimatedGas) * this.GAS_LIMIT_BUFFER,
          );

          // Get optimal gas price (EIP-1559)
          const feeData = await this.provider.getFeeData();
          logger.info("Registering event on blockchain", {
            batchId: params.batchId,
            eventType: params.eventType,
            gasLimit,
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
          });

          // Send transaction
          const tx = await this.traceabilityContract.registerEvent(
            params.eventType,
            params.batchId,
            latitudeScaled,
            longitudeScaled,
            params.ipfsHash,
            {
              gasLimit,
              maxFeePerGas: feeData.maxFeePerGas,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            },
          );
          logger.info("Transaction sent", {
            txHash: tx.hash,
            batchId: params.batchId,
          });

          // Wait for confirmation
          const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);
          if (!receipt || receipt.status !== 1) {
            throw new AppError("Transaction failed", 500);
          }

          // Parse event to get eventId
          const eventLog = receipt.logs.find((log: any) => {
            try {
              const parsedLog =
                this.traceabilityContract.interface.parseLog(log);
              return parsedLog?.name === "EventRegistered";
            } catch {
              return false;
            }
          });

          let eventId = "";
          if (eventLog) {
            const parsed =
              this.traceabilityContract.interface.parseLog(eventLog);
            eventId = parsed?.args[0]; // First argument is eventId
          }

          logger.info("Event registered successfully", {
            txHash: receipt.hash,
            eventId,
            gasUsed: receipt.gasUsed.toString(),
            batchId: params.batchId,
          });

          return {
            eventId,
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString(),
          };
        } catch (error: any) {
          logger.error("Failed to register event on blockchain", {
            error: error.message,
            batchId: params.batchId,
          });

          // Handle specific errors
          if (error.code === "INSUFFICIENT_FUNDS") {
            throw new AppError("Insufficient MATIC for gas fees", 500);
          }
          if (error.code === "NONCE_EXPIRED") {
            throw new AppError("Transaction nonce conflict", 500);
          }
          if (error.message?.includes("Already whitelisted")) {
            throw new AppError("Batch already registered", 400);
          }
          captureException(error, {
            batchId: params.batchId,
            operation: "registerEventOnChain",
          });
          throw error;
        }
      }),
    );
  }

  /**
   * Get batch history from blockchain (with fallback to cache)
   */
  async getBatchHistoryFromChain(batchId: string): Promise<any[]> {
    addBreadcrumb("Fetching batch history", "blockchain", { batchId });

    return instrumentBlockchain("getBatchHistoryFromChain", async () => {
      try {
        logger.info("Fetching batch history from blockchain", { batchId });
        const history =
          await this.traceabilityContract.getBatchHistory(batchId);
        return history.map((event: any) => ({
          eventId: event.eventId,
          eventType: event.eventType,
          producer: event.producer,
          batchId: event.batchId,
          timestamp: new Date(Number(event.timestamp) * 1000),
          latitude: Number(event.location.latitude) / 1_000_000,
          longitude: Number(event.location.longitude) / 1_000_000,
          ipfsHash: event.ipfsHash,
          previousEventHash: event.previousEventHash,
          verified: event.verified,
        }));
      } catch (error: any) {
        logger.error("Failed to fetch batch history from blockchain", {
          error: error.message,
          batchId,
        });
        captureException(error, {
          batchId,
          operation: "getBatchHistoryFromChain",
        });
        throw new AppError("Failed to fetch blockchain data", 500);
      }
    });
  }

  /**
   * Whitelist producer on blockchain
   */
  async whitelistProducerOnChain(params: {
    walletAddress: string;
    businessName: string;
    rfc: string;
    state: string;
    municipality: string;
    latitude: number;
    longitude: number;
  }): Promise<{ txHash: string }> {
    addBreadcrumb("Whitelisting producer", "blockchain", {
      walletAddress: params.walletAddress,
    });

    return instrumentBlockchain("whitelistProducerOnChain", () =>
      this.executeWithRetry(async () => {
        try {
          const latitudeScaled = Math.round(params.latitude * 1_000_000);
          const longitudeScaled = Math.round(params.longitude * 1_000_000);
          const tx = await this.producerCertContract.whitelistProducer(
            params.walletAddress,
            params.businessName,
            params.rfc,
            params.state,
            params.municipality,
            latitudeScaled,
            longitudeScaled,
          );
          const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);
          logger.info("Producer whitelisted on blockchain", {
            walletAddress: params.walletAddress,
            txHash: receipt.hash,
          });
          return { txHash: receipt.hash };
        } catch (error: any) {
          logger.error("Failed to whitelist producer", {
            error: error.message,
            walletAddress: params.walletAddress,
          });
          captureException(error, {
            walletAddress: params.walletAddress,
            operation: "whitelistProducerOnChain",
          });
          throw error;
        }
      }),
    );
  }

  /**
   * Mint NFT for batch
   */
  async mintBatchNFT(params: {
    producerAddress: string;
    batchNumber: string;
    ipfsMetadataHash: string;
  }): Promise<{ tokenId: string; txHash: string }> {
    addBreadcrumb("Minting batch NFT", "blockchain", {
      batchNumber: params.batchNumber,
    });

    return instrumentBlockchain("mintBatchNFT", () =>
      this.executeWithRetry(async () => {
        try {
          const tokenURI = `ipfs://${params.ipfsMetadataHash}`;
          const tx = await this.batchTokenContract.mintBatch(
            params.producerAddress,
            params.batchNumber,
            tokenURI,
          );
          const receipt = await tx.wait(this.REQUIRED_CONFIRMATIONS);

          // Get tokenId from event
          const mintEvent = receipt.logs.find((log: any) => {
            try {
              const parsedLog = this.batchTokenContract.interface.parseLog(log);
              return parsedLog?.name === "BatchMinted";
            } catch {
              return false;
            }
          });

          let tokenId = "";
          if (mintEvent) {
            const parsed =
              this.batchTokenContract.interface.parseLog(mintEvent);
            tokenId = parsed?.args.tokenId.toString();
          }

          logger.info("Batch NFT minted", {
            batchNumber: params.batchNumber,
            tokenId,
            txHash: receipt.hash,
          });
          return { tokenId, txHash: receipt.hash };
        } catch (error: any) {
          logger.error("Failed to mint batch NFT", {
            error: error.message,
            batchNumber: params.batchNumber,
          });
          captureException(error, {
            batchNumber: params.batchNumber,
            operation: "mintBatchNFT",
          });
          throw error;
        }
      }),
    );
  }

  /**
   * Execute function with retry mechanism (exponential backoff)
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 1,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= this.MAX_RETRIES) {
        logger.error("Max retries reached", { attempt, error: error.message });
        throw error;
      }
      const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn("Retrying blockchain operation", {
        attempt,
        delay,
        error: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.executeWithRetry(fn, attempt + 1);
    }
  }

  /**
   * Listen to blockchain events and sync to database
   */
  startEventListener(callback: (event: any) => Promise<void>): void {
    this.traceabilityContract.on(
      "EventRegistered",
      async (
        eventId,
        batchId,
        producer,
        eventType,
        timestamp,
        ipfsHash,
        event,
      ) => {
        try {
          logger.info("Blockchain event detected", {
            eventId,
            batchId,
            eventType,
          });
          await callback({
            eventId,
            batchId,
            producer,
            eventType,
            timestamp: new Date(Number(timestamp) * 1000),
            ipfsHash,
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
          });
        } catch (error: any) {
          logger.error("Failed to process blockchain event", {
            error: error.message,
            eventId,
          });
        }
      },
    );
    logger.info("Blockchain event listener started");
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }
}
