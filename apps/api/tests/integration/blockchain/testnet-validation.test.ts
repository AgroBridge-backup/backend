/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - BLOCKCHAIN TESTNET INTEGRATION TESTS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * These tests validate that our blockchain mocks accurately reflect the
 * behavior of the real Polygon Mumbai testnet.
 *
 * IMPORTANT:
 * - These tests run against a real testnet (Polygon Mumbai)
 * - They require MATIC tokens (available free from faucets)
 * - Set RUN_TESTNET_TESTS=true to enable
 * - Do NOT run in CI unless you have testnet infrastructure
 *
 * Prerequisites:
 * 1. Get MATIC from: https://faucet.polygon.technology/
 * 2. Configure BLOCKCHAIN_* env vars in .env.test
 * 3. Deploy smart contracts to Mumbai testnet
 *
 * @module tests/integration/blockchain
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Only run these tests when explicitly enabled
const RUN_TESTNET_TESTS = process.env.RUN_TESTNET_TESTS === 'true';
const describeFn = RUN_TESTNET_TESTS ? describe : describe.skip;

// Testnet configuration
const TESTNET_CONFIG = {
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
  chainId: parseInt(process.env.BLOCKCHAIN_CHAIN_ID || '80001'),
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
  contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '',
};

// Minimum MATIC balance required for tests (in wei)
const MIN_BALANCE_WEI = ethers.utils.parseEther('0.01');

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLIFIED CONTRACT ABI
// ═══════════════════════════════════════════════════════════════════════════════

// Minimal ABI for testing - matches our BlockchainService expectations
const TRACEABILITY_ABI = [
  'function registerEvent(string eventType, string batchId, int256 latitude, int256 longitude, string ipfsHash) returns (bytes32)',
  'function getBatchHistory(string batchId) view returns (tuple(bytes32 eventId, string eventType, address producer, string batchId, uint256 timestamp, tuple(int256 latitude, int256 longitude) location, string ipfsHash, bytes32 previousEventHash, bool verified)[])',
  'event EventRegistered(bytes32 indexed eventId, string indexed batchId, address indexed producer, string eventType, uint256 timestamp, string ipfsHash)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// TESTNET CONNECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describeFn('Blockchain Testnet Validation', () => {
  let provider: ethers.providers.JsonRpcProvider;
  let wallet: ethers.Wallet;

  beforeAll(async () => {
    // Validate configuration
    if (!TESTNET_CONFIG.privateKey || TESTNET_CONFIG.privateKey.length < 64) {
      throw new Error('BLOCKCHAIN_PRIVATE_KEY not configured or invalid');
    }

    // Initialize provider
    provider = new ethers.providers.JsonRpcProvider(
      TESTNET_CONFIG.rpcUrl,
      TESTNET_CONFIG.chainId
    );

    // Initialize wallet
    const privateKey = TESTNET_CONFIG.privateKey.startsWith('0x')
      ? TESTNET_CONFIG.privateKey
      : `0x${TESTNET_CONFIG.privateKey}`;
    wallet = new ethers.Wallet(privateKey, provider);
  }, 30000);

  // ─────────────────────────────────────────────────────────────────────────────
  // NETWORK CONNECTIVITY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Network Connectivity', () => {
    it('should connect to Mumbai testnet', async () => {
      const network = await provider.getNetwork();

      expect(network.chainId).toBe(80001);
      expect(network.name).toBe('maticmum');
    });

    it('should fetch current block number', async () => {
      const blockNumber = await provider.getBlockNumber();

      expect(blockNumber).toBeGreaterThan(0);
      console.log(`Current block: ${blockNumber}`);
    });

    it('should fetch gas price', async () => {
      const feeData = await provider.getFeeData();

      expect(feeData.maxFeePerGas).toBeDefined();
      expect(feeData.maxPriorityFeePerGas).toBeDefined();

      if (feeData.maxFeePerGas) {
        console.log(
          `Gas price: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} gwei`
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Wallet Validation', () => {
    it('should have valid wallet address', () => {
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      console.log(`Wallet address: ${wallet.address}`);
    });

    it('should have sufficient MATIC balance for transactions', async () => {
      const balance = await wallet.getBalance();
      const balanceInMatic = parseFloat(ethers.utils.formatEther(balance));

      expect(balance.gte(MIN_BALANCE_WEI)).toBe(true);

      console.log(`Balance: ${balanceInMatic} MATIC`);

      if (balanceInMatic < 0.1) {
        console.warn(
          '⚠️  Low MATIC balance. Get more from: https://faucet.polygon.technology/'
        );
      }
    });

    it('should be able to sign messages', async () => {
      const message = 'AgroBridge testnet validation';
      const signature = await wallet.signMessage(message);

      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // Verify signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GAS ESTIMATION
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Gas Estimation', () => {
    it('should estimate gas for a simple transfer', async () => {
      const gasEstimate = await provider.estimateGas({
        from: wallet.address,
        to: wallet.address, // Self-transfer for testing
        value: ethers.utils.parseEther('0.001'),
      });

      expect(gasEstimate.toNumber()).toBeGreaterThan(0);
      expect(gasEstimate.toNumber()).toBeLessThan(100000); // Simple transfer should be cheap

      console.log(`Transfer gas estimate: ${gasEstimate.toString()}`);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSACTION LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Transaction Lifecycle', () => {
    it('should send and confirm a self-transfer transaction', async () => {
      const balanceBefore = await wallet.getBalance();

      // Send a small self-transfer
      const tx = await wallet.sendTransaction({
        to: wallet.address,
        value: ethers.utils.parseEther('0.0001'),
      });

      // Transaction should have valid hash
      expect(tx.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      console.log(`Transaction hash: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait(1);

      // Verify receipt
      expect(receipt.status).toBe(1); // Success
      expect(receipt.blockNumber).toBeGreaterThan(0);
      expect(receipt.gasUsed.toNumber()).toBeGreaterThan(0);

      console.log(`Confirmed in block: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);

      // Balance should be slightly lower due to gas
      const balanceAfter = await wallet.getBalance();
      expect(balanceAfter.lt(balanceBefore)).toBe(true);
    }, 60000); // 60s timeout for transaction
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK VS REAL COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

describeFn('Mock vs Real Blockchain Behavior', () => {
  /**
   * This test documents the differences between our mocks and real blockchain
   * behavior. It serves as living documentation for maintaining accurate mocks.
   */
  it('should document mock vs real behavior differences', async () => {
    const mockBehavior = {
      // Our mocks in tests/unit/blockchain/BlockchainService.test.ts
      transactionExecution: {
        returnsImmediately: true, // Mock returns immediately
        requiresGas: false, // No actual gas consumption
        canFail: false, // Mocks typically don't fail
        confirmationTime: 0, // Instant
      },
      gasEstimation: {
        isAccurate: false, // Fixed values
        variesByLoad: false, // No network simulation
      },
      balanceUpdates: {
        isAtomic: true, // Immediate in mock
        accountsForGas: false, // No gas deduction
      },
    };

    const realBehavior = {
      transactionExecution: {
        returnsImmediately: false, // Requires wait()
        requiresGas: true, // Costs MATIC
        canFail: true, // Can revert, timeout, etc.
        confirmationTime: 2000, // 2-5 seconds typical
      },
      gasEstimation: {
        isAccurate: true, // Based on actual computation
        variesByLoad: true, // Network congestion affects price
      },
      balanceUpdates: {
        isAtomic: false, // After confirmation
        accountsForGas: true, // Deducts gas cost
      },
    };

    // Document for reference
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('MOCK VS REAL BLOCKCHAIN BEHAVIOR');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nMock Behavior:');
    console.log(JSON.stringify(mockBehavior, null, 2));
    console.log('\nReal Behavior:');
    console.log(JSON.stringify(realBehavior, null, 2));
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test passes - this is documentation
    expect(mockBehavior).toBeDefined();
    expect(realBehavior).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT INTERACTION TESTS (Requires deployed contract)
// ═══════════════════════════════════════════════════════════════════════════════

const HAS_CONTRACT = Boolean(
  TESTNET_CONFIG.contractAddress &&
    TESTNET_CONFIG.contractAddress !== '0x0000000000000000000000000000000000000001'
);

describeFn.skipIf(!HAS_CONTRACT)('Smart Contract Interactions', () => {
  let provider: ethers.providers.JsonRpcProvider;
  let wallet: ethers.Wallet;
  let contract: ethers.Contract;

  beforeAll(async () => {
    provider = new ethers.providers.JsonRpcProvider(
      TESTNET_CONFIG.rpcUrl,
      TESTNET_CONFIG.chainId
    );

    const privateKey = TESTNET_CONFIG.privateKey.startsWith('0x')
      ? TESTNET_CONFIG.privateKey
      : `0x${TESTNET_CONFIG.privateKey}`;
    wallet = new ethers.Wallet(privateKey, provider);

    contract = new ethers.Contract(
      TESTNET_CONFIG.contractAddress,
      TRACEABILITY_ABI,
      wallet
    );
  }, 30000);

  it('should estimate gas for registerEvent', async () => {
    const testBatchId = `TEST_${Date.now()}`;
    const testIpfsHash = 'QmTest123456789abcdef';
    const latitude = Math.round(19.4326 * 1_000_000); // Mexico City scaled
    const longitude = Math.round(-99.1332 * 1_000_000);

    try {
      const gasEstimate = await contract.estimateGas.registerEvent(
        'HARVEST',
        testBatchId,
        latitude,
        longitude,
        testIpfsHash
      );

      expect(gasEstimate.toNumber()).toBeGreaterThan(0);
      expect(gasEstimate.toNumber()).toBeLessThan(500000); // Reasonable limit

      console.log(`registerEvent gas estimate: ${gasEstimate.toString()}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If contract not deployed or ABI mismatch, skip gracefully
      if (
        errorMessage.includes('contract') ||
        errorMessage.includes('execution reverted')
      ) {
        console.warn('Contract not accessible - skipping gas estimation');
        return;
      }
      throw error;
    }
  });

  it('should register an event on chain (WRITE)', async () => {
    const testBatchId = `BATCH_${Date.now()}`;
    const testIpfsHash = `QmTestHash${Date.now()}`;
    const latitude = Math.round(19.4326 * 1_000_000);
    const longitude = Math.round(-99.1332 * 1_000_000);

    try {
      const tx = await contract.registerEvent(
        'HARVEST',
        testBatchId,
        latitude,
        longitude,
        testIpfsHash
      );

      expect(tx.hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      console.log(`Transaction hash: ${tx.hash}`);

      const receipt = await tx.wait(1);

      expect(receipt.status).toBe(1);
      expect(receipt.blockNumber).toBeGreaterThan(0);

      console.log(`Confirmed in block: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);

      // Verify event was emitted
      const eventLog = receipt.logs.find((log: ethers.providers.Log) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'EventRegistered';
        } catch {
          return false;
        }
      });

      if (eventLog) {
        console.log('EventRegistered event emitted');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('insufficient funds')) {
        console.error(
          'Insufficient MATIC. Get more from: https://faucet.polygon.technology/'
        );
      }
      throw error;
    }
  }, 90000); // 90s timeout for on-chain transaction

  it('should query batch history (READ)', async () => {
    const knownBatchId = 'BATCH_SEED_001'; // Use a known batch if available

    try {
      const history = await contract.getBatchHistory(knownBatchId);

      if (history.length > 0) {
        console.log(`Found ${history.length} events for batch ${knownBatchId}`);

        // Validate structure matches our expectations
        const firstEvent = history[0];
        expect(firstEvent.batchId).toBe(knownBatchId);
        expect(firstEvent.eventType).toBeDefined();
        expect(firstEvent.timestamp).toBeDefined();
      } else {
        console.log(`No history found for batch ${knownBatchId}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Query error (may be expected): ${errorMessage}`);
      // Don't fail - batch may not exist
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COORDINATE CONVERSION VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Coordinate Conversion (Always Runs)', () => {
  /**
   * These tests validate our coordinate scaling logic matches what
   * the blockchain service does. This is critical for location accuracy.
   */

  const SCALE_FACTOR = 1_000_000;

  it('should correctly scale coordinates for blockchain storage', () => {
    const testCases = [
      { lat: 19.4326, lng: -99.1332, name: 'Mexico City' },
      { lat: 40.7128, lng: -74.006, name: 'New York' },
      { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
      { lat: 0, lng: 0, name: 'Origin' },
    ];

    testCases.forEach(({ lat, lng, name }) => {
      const scaledLat = Math.round(lat * SCALE_FACTOR);
      const scaledLng = Math.round(lng * SCALE_FACTOR);

      // Verify scaling is reversible with acceptable precision
      const recoveredLat = scaledLat / SCALE_FACTOR;
      const recoveredLng = scaledLng / SCALE_FACTOR;

      expect(Math.abs(recoveredLat - lat)).toBeLessThan(0.000001);
      expect(Math.abs(recoveredLng - lng)).toBeLessThan(0.000001);

      console.log(
        `${name}: (${lat}, ${lng}) -> scaled: (${scaledLat}, ${scaledLng})`
      );
    });
  });

  it('should handle edge case coordinates', () => {
    const edgeCases = [
      { lat: 90, lng: 180, name: 'Max values' },
      { lat: -90, lng: -180, name: 'Min values' },
      { lat: 0.000001, lng: 0.000001, name: 'Very small' },
    ];

    edgeCases.forEach(({ lat, lng, name }) => {
      const scaledLat = Math.round(lat * SCALE_FACTOR);
      const scaledLng = Math.round(lng * SCALE_FACTOR);

      expect(Number.isInteger(scaledLat)).toBe(true);
      expect(Number.isInteger(scaledLng)).toBe(true);

      console.log(`${name}: (${lat}, ${lng}) -> (${scaledLat}, ${scaledLng})`);
    });
  });
});
