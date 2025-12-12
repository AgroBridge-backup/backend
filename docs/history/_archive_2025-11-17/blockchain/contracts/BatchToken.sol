// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IProducerCertification.sol";

/**
 * @title BatchToken
 * @notice An ERC-721 token where each NFT represents a unique batch of produce.
 * @dev Implements UUPS for upgradeability, AccessControl for minting, and ERC2981 for royalties.
 */
contract BatchToken is
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // --- Roles ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // --- State Variables ---
    IProducerCertification public producerCertificationContract;
    uint256 private _tokenIdCounter;
    mapping(uint256 => string) public tokenToBatchNumber;
    mapping(string => uint256) public batchNumberToTokenId;

    // --- Events ---
    event BatchMinted(uint256 indexed tokenId, string indexed batchNumber, address indexed producer, string tokenURI);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract after proxy deployment.
     * @param admin The address for the DEFAULT_ADMIN_ROLE.
     * @param _producerCertificationAddress The address of the ProducerCertification contract.
     * @param royaltyReceiver The address to receive royalty payments.
     * @param royaltyFeeNumerator The royalty fee basis points (e.g., 50 for 0.5%).
     */
    function initialize(
        address admin,
        address _producerCertificationAddress,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator
    ) public initializer {
        __ERC721_init("AgroBridge Batch", "AGB");
        __ERC721URIStorage_init();
        __ERC2981_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin); // Admin can mint initially or grant role to another contract

        producerCertificationContract = IProducerCertification(_producerCertificationAddress);
        _setDefaultRoyalty(royaltyReceiver, royaltyFeeNumerator);
    }

    /**
     * @notice Mints a new batch NFT.
     * @dev Only callable by addresses with MINTER_ROLE. Producer must be certified.
     * @param producer The address of the producer who owns the new batch NFT.
     * @param batchNumber The unique identifier for the batch.
     * @param _tokenURI The IPFS URI for the token's metadata.
     * @return The ID of the newly minted token.
     */
    function mintBatch(
        address producer,
        string calldata batchNumber,
        string calldata _tokenURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(producerCertificationContract.isProducerCertified(producer), "Producer not certified");
        require(batchNumberToTokenId[batchNumber] == 0, "Batch already tokenized");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(producer, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        tokenToBatchNumber[tokenId] = batchNumber;
        batchNumberToTokenId[batchNumber] = tokenId;

        emit BatchMinted(tokenId, batchNumber, producer, _tokenURI);
        return tokenId;
    }

    // --- Admin & Override Functions ---

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // The following functions are overrides required by Solidity.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
