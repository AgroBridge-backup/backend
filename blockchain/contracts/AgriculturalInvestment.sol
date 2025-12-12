// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgriculturalInvestment
 * @dev Smart contract empresarial para inversiones agrícolas con milestone-based payouts
 * @author AgroBridge Team
 * @notice Sistema de escrow automatizado para financiamiento agrícola con garantías blockchain
 * 
 * FEATURES:
 * - Milestone-based payments con validación de evidencia
 * - Sistema de disputas con arbitraje
 * - Whitelist de productores verificados
 * - Soporte multi-token (ETH/MATIC + ERC20)
 * - Emergency functions para casos extremos
 * - Gas-optimized con packed structs
 */
contract AgriculturalInvestment is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    // ========== ROLES ==========
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    
    // ========== STRUCTS (GAS OPTIMIZED) ==========
    
    struct Investment {
        address investor;
        address producer;
        address tokenAddress; // address(0) para ETH/MATIC
        uint128 amount; // Soporte hasta ~340 trillion tokens con 18 decimals
        uint96 totalPaid;
        uint96 remainingBalance;
        uint32 createdAt;
        uint8 producerPercentage; // 0-100
        uint8 investorPercentage; // 0-100
        InvestmentStatus status;
    }
    
    struct Milestone {
        bytes32 descriptionHash; // IPFS hash para descripción completa
        bytes32 evidenceHash; // IPFS hash para evidencia de cumplimiento
        uint128 payoutAmount;
        uint32 targetDate;
        uint32 completedAt;
        uint8 payoutPercentage;
        MilestoneStatus status;
        address verifier;
    }
    
    struct Dispute {
        address initiator;
        bytes32 reasonHash; // IPFS hash
        uint32 createdAt;
        uint32 resolvedAt;
        DisputeStatus status;
        DisputeResolution resolution;
    }
    
    struct ProducerReputation {
        uint32 totalInvestments;
        uint32 completedInvestments;
        uint32 disputedInvestments;
        uint96 totalFundsRaised;
        bool isWhitelisted;
        bool isBlacklisted;
    }
    
    enum InvestmentStatus {
        Active,
        Completed,
        Cancelled,
        Disputed,
        Refunded
    }
    
    enum MilestoneStatus {
        Pending,
        InProgress,
        Completed,
        Failed,
        Disputed
    }
    
    enum DisputeStatus {
        Open,
        UnderReview,
        Resolved,
        Escalated
    }
    
    enum DisputeResolution {
        None,
        InvestorFavor,
        ProducerFavor,
        PartialRefund,
        Arbitrated
    }
    
    // ========== STATE VARIABLES ==========
    
    uint256 public investmentCounter;
    uint8 public platformFeePercentage = 5; // 5%
    uint8 public maxPlatformFee = 10; // Hard cap
    address public platformWallet;
    address public emergencyWallet;
    
    uint256 public minInvestmentAmount = 0.01 ether;
    uint256 public maxInvestmentAmount = 1000 ether;
    uint32 public minMilestoneDuration = 7 days;
    uint32 public maxMilestoneDuration = 365 days;
    uint32 public disputePeriod = 14 days;
    
    // Mappings
    mapping(uint256 => Investment) public investments;
    mapping(uint256 => Milestone[]) public investmentMilestones;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public investorInvestments;
    mapping(address => uint256[]) public producerInvestments;
    mapping(address => ProducerReputation) public producerReputations;
    mapping(address => bool) public supportedTokens;
    
    // Rate limiting
    mapping(address => uint256) public lastInvestmentTime;
    uint256 public investmentCooldown = 1 minutes;
    
    // Emergency
    bool public emergencyWithdrawEnabled;
    uint256 public totalLockedFunds;
    
    // ========== EVENTS ==========
    
    event InvestmentCreated(
        uint256 indexed investmentId,
        address indexed investor,
        address indexed producer,
        address tokenAddress,
        uint256 amount,
        uint256 timestamp
    );
    
    event MilestoneCompleted(
        uint256 indexed investmentId,
        uint256 milestoneIndex,
        uint256 payoutAmount,
        address verifier,
        uint256 timestamp
    );
    
    event PayoutProcessed(
        uint256 indexed investmentId,
        address indexed recipient,
        uint256 amount,
        PayoutType payoutType,
        uint256 timestamp
    );
    
    event DisputeCreated(
        uint256 indexed investmentId,
        address indexed initiator,
        bytes32 reasonHash,
        uint256 timestamp
    );
    
    event DisputeResolved(
        uint256 indexed investmentId,
        DisputeResolution resolution,
        address resolver,
        uint256 timestamp
    );
    
    event ProducerWhitelisted(address indexed producer, uint256 timestamp);
    event ProducerBlacklisted(address indexed producer, uint256 timestamp);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount, uint256 timestamp);
    
    enum PayoutType {
        MilestoneCompletion,
        Refund,
        DisputeResolution,
        PlatformFee
    }
    
    // ========== MODIFIERS ==========
    
    modifier onlyInvestor(uint256 _investmentId) {
        require(investments[_investmentId].investor == msg.sender, "Not investor");
        _;
    }
    
    modifier onlyProducer(uint256 _investmentId) {
        require(investments[_investmentId].producer == msg.sender, "Not producer");
        _;
    }
    
    modifier investmentExists(uint256 _investmentId) {
        require(_investmentId < investmentCounter, "Investment does not exist");
        _;
    }
    
    modifier whitelistedProducer(address _producer) {
        require(producerReputations[_producer].isWhitelisted, "Producer not whitelisted");
        require(!producerReputations[_producer].isBlacklisted, "Producer blacklisted");
        _;
    }
    
    modifier rateLimited() {
        require(
            block.timestamp >= lastInvestmentTime[msg.sender] + investmentCooldown,
            "Rate limit exceeded"
        );
        _;
        lastInvestmentTime[msg.sender] = block.timestamp;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor(address _platformWallet, address _emergencyWallet) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_emergencyWallet != address(0), "Invalid emergency wallet");
        
        platformWallet = _platformWallet;
        emergencyWallet = _emergencyWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(ARBITRATOR_ROLE, msg.sender);
        
        // Soporte nativo para ETH/MATIC
        supportedTokens[address(0)] = true;
    }
    
    // ========== EXTERNAL FUNCTIONS - INVESTMENT CREATION ==========
    
    /**
     * @dev Crear inversión con ETH/MATIC nativo
     */
    function createInvestment(
        address _producer,
        uint8 _producerPercentage,
        bytes32[] memory _milestoneDescriptionHashes,
        uint8[] memory _milestonePayoutPercentages,
        uint32[] memory _milestoneTargetDates
    ) external payable nonReentrant whenNotPaused rateLimited whitelistedProducer(_producer) returns (uint256) {
        return _createInvestment(
            _producer,
            address(0),
            msg.value,
            _producerPercentage,
            _milestoneDescriptionHashes,
            _milestonePayoutPercentages,
            _milestoneTargetDates
        );
    }
    
    /**
     * @dev Crear inversión con token ERC20
     */
    function createInvestmentERC20(
        address _producer,
        address _tokenAddress,
        uint128 _amount,
        uint8 _producerPercentage,
        bytes32[] memory _milestoneDescriptionHashes,
        uint8[] memory _milestonePayoutPercentages,
        uint32[] memory _milestoneTargetDates
    ) external nonReentrant whenNotPaused rateLimited whitelistedProducer(_producer) returns (uint256) {
        require(supportedTokens[_tokenAddress], "Token not supported");
        
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        
        return _createInvestment(
            _producer,
            _tokenAddress,
            _amount,
            _producerPercentage,
            _milestoneDescriptionHashes,
            _milestonePayoutPercentages,
            _milestoneTargetDates
        );
    }
    
    // ========== INTERNAL - INVESTMENT CREATION ==========
    
    function _createInvestment(
        address _producer,
        address _tokenAddress,
        uint256 _amount,
        uint8 _producerPercentage,
        bytes32[] memory _milestoneDescriptionHashes,
        uint8[] memory _milestonePayoutPercentages,
        uint32[] memory _milestoneTargetDates
    ) internal returns (uint256) {
        // Validaciones
        require(_producer != address(0) && _producer != msg.sender, "Invalid producer");
        require(_amount >= minInvestmentAmount && _amount <= maxInvestmentAmount, "Invalid amount");
        require(_producerPercentage > 0 && _producerPercentage <= 100, "Invalid percentage");
        require(
            _milestoneDescriptionHashes.length == _milestonePayoutPercentages.length &&
            _milestoneDescriptionHashes.length == _milestoneTargetDates.length &&
            _milestoneDescriptionHashes.length > 0 &&
            _milestoneDescriptionHashes.length <= 10,
            "Invalid milestones"
        );
        
        uint256 investmentId = investmentCounter++;
        uint8 investorPercentage = 100 - _producerPercentage;
        
        // Crear inversión
        investments[investmentId] = Investment({
            investor: msg.sender,
            producer: _producer,
            tokenAddress: _tokenAddress,
            amount: uint128(_amount),
            totalPaid: 0,
            remainingBalance: uint96(_amount),
            createdAt: uint32(block.timestamp),
            producerPercentage: _producerPercentage,
            investorPercentage: investorPercentage,
            status: InvestmentStatus.Active
        });
        
        // Validar y crear milestones
        uint256 totalPercentage = 0;
        uint32 lastTargetDate = uint32(block.timestamp);
        
        for (uint256 i = 0; i < _milestoneDescriptionHashes.length; i++) {
            require(_milestonePayoutPercentages[i] > 0 && _milestonePayoutPercentages[i] <= 100, "Invalid payout %");
            require(_milestoneTargetDates[i] > lastTargetDate, "Invalid milestone order");
            require(
                _milestoneTargetDates[i] >= block.timestamp + minMilestoneDuration &&
                _milestoneTargetDates[i] <= block.timestamp + maxMilestoneDuration,
                "Invalid milestone duration"
            );
            
            totalPercentage += _milestonePayoutPercentages[i];
            lastTargetDate = _milestoneTargetDates[i];
            
            investmentMilestones[investmentId].push(Milestone({
                descriptionHash: _milestoneDescriptionHashes[i],
                evidenceHash: bytes32(0),
                payoutAmount: 0,
                targetDate: _milestoneTargetDates[i],
                completedAt: 0,
                payoutPercentage: _milestonePayoutPercentages[i],
                status: MilestoneStatus.Pending,
                verifier: address(0)
            }));
        }
        
        require(totalPercentage == 100, "Percentages must sum to 100");
        
        // Actualizar mappings y reputación
        investorInvestments[msg.sender].push(investmentId);
        producerInvestments[_producer].push(investmentId);
        producerReputations[_producer].totalInvestments++;
        producerReputations[_producer].totalFundsRaised += uint96(_amount

