# 🔗 AgroBridge Blockchain Smart Contracts

This directory contains the Solidity smart contracts that form the immutable backbone of the AgroBridge 2.0 traceability platform, designed for deployment on the Polygon PoS network.

## 📋 Core Contracts

The architecture is composed of three main UUPS-upgradeable contracts that work together to provide a robust and secure system.

### 1. `ProducerCertification.sol`
This contract acts as the central authority for managing a whitelist of verified producers.

**Features:**
- **Role-Based Access:** Uses OpenZeppelin's `AccessControl` to manage a `CERTIFIER_ROLE`, which is the only role authorized to add or revoke producers.
- **Producer Whitelist:** Maintains a mapping of producer wallet addresses to their certification status and business details.
- **Upgradeability:** Implements the UUPS proxy pattern, allowing for future upgrades by the admin.

### 2. `TraceabilityRegistry.sol`
This is the core ledger for recording Critical Tracking Events (CTEs) for each batch of produce, designed to be compliant with food safety standards like FSMA Rule 204.

**Features:**
- **Immutable Event Chain:** Each event is cryptographically linked to the previous one for the same batch, creating a verifiable and tamper-evident history.
- **Certified Producers Only:** Integrates with `ProducerCertification` to ensure that only whitelisted producers can register events.
- **Rich Data Storage:** Captures essential data points including event type, GPS coordinates, and an IPFS hash for associated documents.
- **Event Verification:** A `CERTIFIER_ROLE` can verify the authenticity of specific events on-chain.

### 3. `BatchToken.sol`
This contract represents each unique production batch as an ERC-721 Non-Fungible Token (NFT).

**Features:**
- **Digital Twin:** Each NFT serves as a "digital twin" for a physical batch, allowing ownership and custody to be tracked on-chain.
- **Certified Minting:** Only certified producers (verified via `ProducerCertification`) can mint new batch NFTs.
- **Rich Metadata:** The token URI points to an IPFS location containing detailed metadata, photos, and quality reports for the batch.
- **Royalties:** Implements EIP-2981 to enable royalty payments on secondary sales, providing a mechanism to fund producer cooperatives.

## 🚀 Development Setup

### Prerequisites
- Node.js (v18+)
- pnpm (v8+)
- Hardhat

### Installation
1.  Navigate to the root of the monorepo.
2.  Install all dependencies:
    ```bash
    pnpm install
    ```

### Compiling Contracts
To compile the smart contracts, run:
```bash
pnpm --filter blockchain compile
```

### Running Tests
To run the comprehensive test suite:
```bash
pnpm --filter blockchain test
```

### Local Deployment
To deploy the contracts to a local Hardhat network:
1.  Start a local node:
    ```bash
    npx hardhat node
    ```
2.  In a new terminal, run the deployment script:
    ```bash
    npx hardhat run apps/blockchain/scripts/deploy.ts --network localhost
    ```

### Testnet/Mainnet Deployment
1.  Copy `apps/blockchain/.env.example` to `apps/blockchain/.env`.
2.  Fill in the required values (RPC URL, private key, PolygonScan API key).
3.  Run the deployment script for the desired network (e.g., `mumbai`):
    ```bash
    npx hardhat run apps/blockchain/scripts/deploy.ts --network mumbai
    ```

### Seeding Producers
After deployment, you can add test producers to the `ProducerCertification` contract:
```bash
npx hardhat run apps/blockchain/scripts/seed-producers.ts --network <your-network>
```
