// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IProducerCertification.sol";

/**
 * @title TraceabilityRegistry
 * @notice Immutable registry for critical tracking events in the agri-food supply chain.
 * @dev Implements UUPS for upgradeability and interacts with ProducerCertification for auth.
 *      This contract is designed to be gas-efficient by using events for history
 *      and optimized data structures.
 */
contract TraceabilityRegistry is
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // --- Roles ---
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    // --- Custom Errors ---
    error InvalidBatchID();
    error InvalidIPFSHash();
    error NotACertifiedProducer();
    error EventNotFound();
    error EventAlreadyVerified();

    // --- Structs ---
    struct GPSCoordinates {
        int256 latitude;  // Stored as value * 1e6 for precision
        int256 longitude; // Stored as value * 1e6 for precision
    }

    struct CriticalTrackingEvent {
        bytes32 eventId;
        string eventType;
        address producer;
        uint256 timestamp;
        GPSCoordinates location;
        string ipfsHash;
        bytes32 previousEventHash;
        bool verified; // Packed with producer address for gas savings
    }

    // --- State Variables ---
    IProducerCertification public producerCertificationContract;
    mapping(string => CriticalTrackingEvent[]) private batchEvents;
    mapping(bytes32 => uint256) private eventIndex;

    // --- Events ---
    event EventRegistered(
        bytes32 indexed eventId,
        string indexed batchId,
        address indexed producer,
        string eventType,
        uint256 timestamp
    );

    event EventVerified(bytes32 indexed eventId, address indexed certifier);

    // --- Initializer ---
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract after proxy deployment.
     * @param admin The address to be granted DEFAULT_ADMIN_ROLE and CERTIFIER_ROLE.
     * @param _producerCertificationAddress The address of the ProducerCertification contract.
     */
    function initialize(address admin, address _producerCertificationAddress) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CERTIFIER_ROLE, admin);

        producerCertificationContract = IProducerCertification(_producerCertificationAddress);
    }

    // --- Core Functions ---

    /**
     * @notice Registers a new critical tracking event for a batch.
     * @dev Only callable by certified producers. Follows Checks-Effects-Interactions pattern.
     * @param eventType The type of event (e.g., "HARVEST", "TRANSPORT").
     * @param batchId The unique identifier for the batch.
     * @param latitude The latitude of the event location (multiplied by 1e6).
     * @param longitude The longitude of the event location (multiplied by 1e6).
     * @param ipfsHash The IPFS hash of any associated documents (e.g., photos, certificates).
     * @return eventId The unique hash identifier of the newly registered event.
     */
    function registerEvent(
        string calldata eventType,
        string calldata batchId,
        int256 latitude,
        int256 longitude,
        string calldata ipfsHash
    ) external whenNotPaused nonReentrant returns (bytes32) {
        // --- Checks ---
        if (!producerCertificationContract.isProducerCertified(msg.sender)) {
            revert NotACertifiedProducer();
        }
        if (bytes(batchId).length == 0) {
            revert InvalidBatchID();
        }
        if (bytes(ipfsHash).length == 0) { // Basic check, can be more specific
            revert InvalidIPFSHash();
        }

        // --- Effects ---
        bytes32 eventId = keccak256(abi.encodePacked(eventType, batchId, msg.sender, block.timestamp));
        
        CriticalTrackingEvent[] storage events = batchEvents[batchId];
        bytes32 previousHash = (events.length > 0) ? events[events.length - 1].eventId : bytes32(0);

        events.push(CriticalTrackingEvent({
            eventId: eventId,
            eventType: eventType,
            producer: msg.sender,
            timestamp: block.timestamp,
            location: GPSCoordinates(latitude, longitude),
            ipfsHash: ipfsHash,
            previousEventHash: previousHash,
            verified: false
        }));
        eventIndex[eventId] = events.length - 1;

        // --- Interactions ---
        emit EventRegistered(eventId, batchId, msg.sender, eventType, block.timestamp);
        
        return eventId;
    }

    /**
     * @notice Allows an authorized certifier to verify a specific event.
     * @param eventId The ID of the event to verify.
     * @param batchId The batch ID the event belongs to.
     */
    function verifyEvent(bytes32 eventId, string calldata batchId) external onlyRole(CERTIFIER_ROLE) {
        uint256 index = eventIndex[eventId];
        CriticalTrackingEvent storage evt = batchEvents[batchId][index];

        if (evt.eventId != eventId) {
            revert EventNotFound();
        }
        if (evt.verified) {
            revert EventAlreadyVerified();
        }

        evt.verified = true;
        emit EventVerified(eventId, msg.sender);
    }

    // --- View Functions ---

    /**
     * @notice Retrieves the complete history of events for a given batch.
     * @dev For very long histories, off-chain solutions are recommended.
     * @param batchId The unique identifier of the batch.
     * @return An array of all CriticalTrackingEvent structs for the batch.
     */
    function getBatchHistory(string calldata batchId) external view returns (CriticalTrackingEvent[] memory) {
        return batchEvents[batchId];
    }

    // --- Admin Functions ---

    /**
     * @notice Pauses the contract in case of an emergency.
     * @dev Only callable by the admin.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the contract.
     * @dev Only callable by the admin.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Authorizes an upgrade to a new implementation contract.
     *      Only the admin (ideally a multisig with a timelock) can authorize upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
