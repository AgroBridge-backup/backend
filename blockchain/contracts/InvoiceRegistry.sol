// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - INVOICE REGISTRY CONTRACT
 * Phase 2: Revenue Sprint - Blockchain-Backed Invoices
 *
 * Purpose: Store invoice hashes on-chain for immutable proof of invoice integrity.
 * Once registered, invoice data cannot be altered without detection.
 *
 * Key Features:
 * - Register invoice hash + amount
 * - Verify invoice authenticity
 * - Query invoice details
 * - Emit events for indexing
 *
 * @author AgroBridge Engineering Team
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract InvoiceRegistry is Ownable, Pausable, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════════

    struct Invoice {
        bytes32 hash;           // SHA-256 hash of invoice data
        uint256 amount;         // Invoice amount in smallest currency unit (centavos)
        string currency;        // Currency code (MXN, USD)
        address seller;         // Address that registered the invoice
        string buyerId;         // Buyer identifier (RFC, external ID)
        uint256 timestamp;      // Registration timestamp
        bool exists;            // Existence flag
    }

    // UUID => Invoice mapping
    mapping(string => Invoice) public invoices;

    // Total number of registered invoices
    uint256 public totalInvoices;

    // Authorized registrars (AgroBridge backend addresses)
    mapping(address => bool) public authorizedRegistrars;

    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event InvoiceRegistered(
        string indexed uuid,
        bytes32 indexed hash,
        uint256 amount,
        string currency,
        address seller,
        uint256 timestamp
    );

    event InvoiceVerified(
        string indexed uuid,
        address indexed verifier,
        bool isValid,
        uint256 timestamp
    );

    event RegistrarAdded(address indexed registrar, uint256 timestamp);
    event RegistrarRemoved(address indexed registrar, uint256 timestamp);

    // ═══════════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════════

    modifier onlyAuthorized() {
        require(
            authorizedRegistrars[msg.sender] || msg.sender == owner(),
            "InvoiceRegistry: caller is not authorized"
        );
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    constructor() {
        // Owner is automatically an authorized registrar
        authorizedRegistrars[msg.sender] = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MAIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a new invoice hash on-chain
     * @param uuid The fiscal UUID of the invoice (from SAT)
     * @param hash The SHA-256 hash of invoice data
     * @param amount Invoice amount in centavos (e.g., 10000 = $100.00 MXN)
     * @param currency Currency code (e.g., "MXN", "USD")
     * @param buyerId Buyer identifier (RFC or external ID)
     */
    function registerInvoice(
        string memory uuid,
        bytes32 hash,
        uint256 amount,
        string memory currency,
        string memory buyerId
    ) external onlyAuthorized whenNotPaused nonReentrant {
        require(bytes(uuid).length > 0, "InvoiceRegistry: empty UUID");
        require(hash != bytes32(0), "InvoiceRegistry: empty hash");
        require(!invoices[uuid].exists, "InvoiceRegistry: invoice already registered");

        invoices[uuid] = Invoice({
            hash: hash,
            amount: amount,
            currency: currency,
            seller: msg.sender,
            buyerId: buyerId,
            timestamp: block.timestamp,
            exists: true
        });

        totalInvoices++;

        emit InvoiceRegistered(
            uuid,
            hash,
            amount,
            currency,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Verify if an invoice hash matches the on-chain record
     * @param uuid The fiscal UUID of the invoice
     * @param expectedHash The hash to verify against
     * @return isValid True if the hash matches
     */
    function verifyInvoice(
        string memory uuid,
        bytes32 expectedHash
    ) external view returns (bool isValid) {
        Invoice memory invoice = invoices[uuid];
        return invoice.exists && invoice.hash == expectedHash;
    }

    /**
     * @notice Verify and emit event (for logging purposes)
     * @param uuid The fiscal UUID of the invoice
     * @param expectedHash The hash to verify against
     * @return isValid True if the hash matches
     */
    function verifyAndLog(
        string memory uuid,
        bytes32 expectedHash
    ) external returns (bool isValid) {
        Invoice memory invoice = invoices[uuid];
        isValid = invoice.exists && invoice.hash == expectedHash;

        emit InvoiceVerified(uuid, msg.sender, isValid, block.timestamp);
        return isValid;
    }

    /**
     * @notice Get invoice details by UUID
     * @param uuid The fiscal UUID of the invoice
     * @return hash The invoice hash
     * @return amount Invoice amount
     * @return currency Currency code
     * @return seller Seller address
     * @return timestamp Registration timestamp
     */
    function getInvoice(
        string memory uuid
    ) external view returns (
        bytes32 hash,
        uint256 amount,
        string memory currency,
        address seller,
        uint256 timestamp
    ) {
        require(invoices[uuid].exists, "InvoiceRegistry: invoice not found");
        Invoice memory invoice = invoices[uuid];
        return (
            invoice.hash,
            invoice.amount,
            invoice.currency,
            invoice.seller,
            invoice.timestamp
        );
    }

    /**
     * @notice Check if an invoice exists
     * @param uuid The fiscal UUID of the invoice
     * @return exists True if the invoice is registered
     */
    function invoiceExists(string memory uuid) external view returns (bool) {
        return invoices[uuid].exists;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add an authorized registrar
     * @param registrar Address to authorize
     */
    function addRegistrar(address registrar) external onlyOwner {
        require(registrar != address(0), "InvoiceRegistry: zero address");
        require(!authorizedRegistrars[registrar], "InvoiceRegistry: already authorized");

        authorizedRegistrars[registrar] = true;
        emit RegistrarAdded(registrar, block.timestamp);
    }

    /**
     * @notice Remove an authorized registrar
     * @param registrar Address to deauthorize
     */
    function removeRegistrar(address registrar) external onlyOwner {
        require(authorizedRegistrars[registrar], "InvoiceRegistry: not authorized");

        authorizedRegistrars[registrar] = false;
        emit RegistrarRemoved(registrar, block.timestamp);
    }

    /**
     * @notice Pause the contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if an address is an authorized registrar
     * @param registrar Address to check
     * @return isAuthorized True if authorized
     */
    function isRegistrar(address registrar) external view returns (bool) {
        return authorizedRegistrars[registrar];
    }

    /**
     * @notice Get contract statistics
     * @return total Total number of registered invoices
     * @return isPaused Whether the contract is paused
     */
    function getStats() external view returns (uint256 total, bool isPaused) {
        return (totalInvoices, paused());
    }
}
