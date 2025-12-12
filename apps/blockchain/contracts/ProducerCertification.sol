// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ProducerCertification
 * @notice Manages the whitelist of verified producers and their certifications.
 * @dev This contract uses UUPS for upgradeability and AccessControl for role management.
 */
contract ProducerCertification is AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    // --- Roles ---
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    // --- Enums and Structs ---
    enum CertificationType { GLOBALGAP, ORGANIC_USDA, ORGANIC_EU, RAINFOREST_ALLIANCE, FAIR_TRADE, SENASICA }

    struct Producer {
        address wallet;
        string businessName;
        string rfc;
        string state;
        string municipality;
        int256 latitude;
        int256 longitude;
        bool isWhitelisted;
        uint256 whitelistedAt;
        uint256 totalBatches;
    }

    struct Certification {
        CertificationType certType;
        string certifier;
        string certificateNumber;
        string ipfsHash;
        uint256 issuedAt;
        uint256 expiresAt;
        bool isActive;
    }

    // --- State Variables ---
    mapping(address => Producer) public producers;
    mapping(address => mapping(CertificationType => Certification)) public certifications;
    address[] public activeProducers;
    uint256 public totalProducers;

    // --- Events ---
    event ProducerWhitelisted(address indexed producer, string businessName, uint256 timestamp);
    event ProducerRemoved(address indexed producer, uint256 timestamp);
    event CertificationAdded(address indexed producer, CertificationType indexed certType, uint256 expiresAt);
    event CertificationRevoked(address indexed producer, CertificationType indexed certType, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CERTIFIER_ROLE, admin);
    }

    // --- Core Functions ---

    function whitelistProducer(
        address producerWallet,
        string calldata businessName,
        string calldata rfc,
        string calldata state,
        string calldata municipality,
        int256 latitude,
        int256 longitude
    ) external whenNotPaused onlyRole(CERTIFIER_ROLE) {
        require(producerWallet != address(0), "Invalid address");
        require(!producers[producerWallet].isWhitelisted, "Already whitelisted");

        producers[producerWallet] = Producer({
            wallet: producerWallet,
            businessName: businessName,
            rfc: rfc,
            state: state,
            municipality: municipality,
            latitude: latitude,
            longitude: longitude,
            isWhitelisted: true,
            whitelistedAt: block.timestamp,
            totalBatches: 0
        });

        activeProducers.push(producerWallet);
        totalProducers++;
        emit ProducerWhitelisted(producerWallet, businessName, block.timestamp);
    }

    function addCertification(
        address producer,
        CertificationType certType,
        string calldata certifier,
        string calldata certificateNumber,
        string calldata ipfsHash,
        uint256 expiresAt
    ) external onlyRole(CERTIFIER_ROLE) {
        require(producers[producer].isWhitelisted, "Producer not whitelisted");
        require(expiresAt > block.timestamp, "Invalid expiration");

        certifications[producer][certType] = Certification({
            certType: certType,
            certifier: certifier,
            certificateNumber: certificateNumber,
            ipfsHash: ipfsHash,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });

        emit CertificationAdded(producer, certType, expiresAt);
    }

    // --- View Functions ---

    function isProducerCertified(address producer) external view returns (bool) {
        return producers[producer].isWhitelisted;
    }

    function hasCertification(address producer, CertificationType certType) external view returns (bool) {
        Certification memory cert = certifications[producer][certType];
        return cert.isActive && cert.expiresAt > block.timestamp;
    }

    function getProducer(address producer) external view returns (Producer memory) {
        return producers[producer];
    }
    
    // --- Internal/External Interaction ---

    function incrementBatchCount(address producer) external {
        // In a real scenario, this should be protected, e.g., only callable by the Traceability contract
        require(producers[producer].isWhitelisted, "Producer not whitelisted");
        producers[producer].totalBatches++;
    }

    // --- Admin Functions ---

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
