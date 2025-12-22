// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGROBRIDGE - REFERRAL PROGRAM CONTRACT
 * Phase 3: Revenue Sprint - Blockchain-Verified Referral System
 *
 * Purpose: Record referrals on-chain to prevent gaming and Sybil attacks.
 * All referral activity is transparently verifiable.
 *
 * Key Features:
 * - Register referrals with proof
 * - Track 30-day activity milestones
 * - Transparent leaderboard data
 * - Anti-fraud mechanisms
 *
 * @author AgroBridge Engineering Team
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ReferralProgram is Ownable, Pausable, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════════

    struct Referral {
        address referrer;           // Wallet of referrer
        address referred;           // Wallet of referred user
        string referralCode;        // Human-readable referral code
        uint256 createdAt;          // When referral was created
        uint256 activatedAt;        // When 30-day milestone was reached (0 if not yet)
        bool isActive;              // True after 30 days of verified activity
        uint256 activityScore;      // Accumulated activity points
    }

    struct LeaderboardEntry {
        address referrer;
        uint256 activeReferrals;
        uint256 totalReferrals;
        uint256 lastUpdated;
    }

    // Referral ID => Referral data
    mapping(bytes32 => Referral) public referrals;

    // Referrer address => array of referral IDs
    mapping(address => bytes32[]) public referralsByReferrer;

    // Referred address => has been referred
    mapping(address => bool) public hasBeenReferred;

    // Month-Year => Leaderboard entries
    mapping(string => LeaderboardEntry[]) public monthlyLeaderboard;

    // Referrer address => active referral count
    mapping(address => uint256) public activeReferralCount;

    // Authorized operators (AgroBridge backend)
    mapping(address => bool) public authorizedOperators;

    // Configuration
    uint256 public constant ACTIVATION_THRESHOLD_DAYS = 30;
    uint256 public constant MIN_ACTIVITY_SCORE = 100; // Minimum score for activation

    // Statistics
    uint256 public totalReferrals;
    uint256 public totalActiveReferrals;

    // ═══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event ReferralCreated(
        bytes32 indexed referralId,
        address indexed referrer,
        address indexed referred,
        string referralCode,
        uint256 timestamp
    );

    event ReferralActivated(
        bytes32 indexed referralId,
        address indexed referrer,
        address indexed referred,
        uint256 activityScore,
        uint256 timestamp
    );

    event ActivityRecorded(
        bytes32 indexed referralId,
        address indexed referred,
        uint256 activityPoints,
        uint256 totalScore,
        uint256 timestamp
    );

    event LeaderboardUpdated(
        string indexed monthYear,
        address indexed referrer,
        uint256 activeReferrals,
        uint256 rank,
        uint256 timestamp
    );

    event OperatorAdded(address indexed operator, uint256 timestamp);
    event OperatorRemoved(address indexed operator, uint256 timestamp);

    // ═══════════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════════

    modifier onlyOperator() {
        require(
            authorizedOperators[msg.sender] || msg.sender == owner(),
            "ReferralProgram: caller is not an operator"
        );
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    constructor() {
        authorizedOperators[msg.sender] = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MAIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new referral
     * @param referrer Wallet address of the referrer
     * @param referred Wallet address of the referred user
     * @param referralCode Human-readable referral code
     * @return referralId The unique ID of this referral
     */
    function createReferral(
        address referrer,
        address referred,
        string memory referralCode
    ) external onlyOperator whenNotPaused nonReentrant returns (bytes32 referralId) {
        require(referrer != address(0), "ReferralProgram: invalid referrer");
        require(referred != address(0), "ReferralProgram: invalid referred");
        require(referrer != referred, "ReferralProgram: cannot refer yourself");
        require(!hasBeenReferred[referred], "ReferralProgram: already referred");
        require(bytes(referralCode).length > 0, "ReferralProgram: empty code");

        referralId = keccak256(abi.encodePacked(referrer, referred, block.timestamp));

        referrals[referralId] = Referral({
            referrer: referrer,
            referred: referred,
            referralCode: referralCode,
            createdAt: block.timestamp,
            activatedAt: 0,
            isActive: false,
            activityScore: 0
        });

        referralsByReferrer[referrer].push(referralId);
        hasBeenReferred[referred] = true;
        totalReferrals++;

        emit ReferralCreated(
            referralId,
            referrer,
            referred,
            referralCode,
            block.timestamp
        );

        return referralId;
    }

    /**
     * @notice Record activity for a referred user
     * @param referralId The referral ID
     * @param activityPoints Points to add (e.g., 10 for login, 50 for batch creation)
     */
    function recordActivity(
        bytes32 referralId,
        uint256 activityPoints
    ) external onlyOperator whenNotPaused {
        Referral storage referral = referrals[referralId];
        require(referral.createdAt > 0, "ReferralProgram: referral not found");
        require(!referral.isActive, "ReferralProgram: already activated");

        referral.activityScore += activityPoints;

        emit ActivityRecorded(
            referralId,
            referral.referred,
            activityPoints,
            referral.activityScore,
            block.timestamp
        );

        // Check if ready for activation
        uint256 daysSinceCreation = (block.timestamp - referral.createdAt) / 1 days;
        if (
            daysSinceCreation >= ACTIVATION_THRESHOLD_DAYS &&
            referral.activityScore >= MIN_ACTIVITY_SCORE
        ) {
            _activateReferral(referralId);
        }
    }

    /**
     * @notice Manually activate a referral (after verification)
     * @param referralId The referral ID
     */
    function activateReferral(
        bytes32 referralId
    ) external onlyOperator whenNotPaused {
        _activateReferral(referralId);
    }

    /**
     * @notice Update monthly leaderboard
     * @param monthYear Format: "2025-01"
     * @param referrer Referrer address
     */
    function updateLeaderboard(
        string memory monthYear,
        address referrer
    ) external onlyOperator {
        uint256 activeCount = activeReferralCount[referrer];
        uint256 totalCount = referralsByReferrer[referrer].length;

        // Find or create entry
        bool found = false;
        LeaderboardEntry[] storage entries = monthlyLeaderboard[monthYear];

        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].referrer == referrer) {
                entries[i].activeReferrals = activeCount;
                entries[i].totalReferrals = totalCount;
                entries[i].lastUpdated = block.timestamp;
                found = true;
                break;
            }
        }

        if (!found) {
            entries.push(LeaderboardEntry({
                referrer: referrer,
                activeReferrals: activeCount,
                totalReferrals: totalCount,
                lastUpdated: block.timestamp
            }));
        }

        // Calculate rank (simple bubble for now - off-chain for production)
        uint256 rank = 1;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].activeReferrals > activeCount) {
                rank++;
            }
        }

        emit LeaderboardUpdated(
            monthYear,
            referrer,
            activeCount,
            rank,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function _activateReferral(bytes32 referralId) internal {
        Referral storage referral = referrals[referralId];
        require(referral.createdAt > 0, "ReferralProgram: referral not found");
        require(!referral.isActive, "ReferralProgram: already active");

        referral.isActive = true;
        referral.activatedAt = block.timestamp;
        activeReferralCount[referral.referrer]++;
        totalActiveReferrals++;

        emit ReferralActivated(
            referralId,
            referral.referrer,
            referral.referred,
            referral.activityScore,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get referral details
     * @param referralId The referral ID
     */
    function getReferral(bytes32 referralId) external view returns (
        address referrer,
        address referred,
        string memory referralCode,
        uint256 createdAt,
        uint256 activatedAt,
        bool isActive,
        uint256 activityScore
    ) {
        Referral memory r = referrals[referralId];
        return (
            r.referrer,
            r.referred,
            r.referralCode,
            r.createdAt,
            r.activatedAt,
            r.isActive,
            r.activityScore
        );
    }

    /**
     * @notice Get all referral IDs for a referrer
     * @param referrer The referrer address
     */
    function getReferralIds(address referrer) external view returns (bytes32[] memory) {
        return referralsByReferrer[referrer];
    }

    /**
     * @notice Get active referral count for an address
     * @param referrer The referrer address
     */
    function getActiveReferralCount(address referrer) external view returns (uint256) {
        return activeReferralCount[referrer];
    }

    /**
     * @notice Get leaderboard for a month
     * @param monthYear Format: "2025-01"
     */
    function getLeaderboard(string memory monthYear) external view returns (
        LeaderboardEntry[] memory
    ) {
        return monthlyLeaderboard[monthYear];
    }

    /**
     * @notice Get contract statistics
     */
    function getStats() external view returns (
        uint256 total,
        uint256 active,
        bool isPaused
    ) {
        return (totalReferrals, totalActiveReferrals, paused());
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "ReferralProgram: zero address");
        authorizedOperators[operator] = true;
        emit OperatorAdded(operator, block.timestamp);
    }

    function removeOperator(address operator) external onlyOwner {
        authorizedOperators[operator] = false;
        emit OperatorRemoved(operator, block.timestamp);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
