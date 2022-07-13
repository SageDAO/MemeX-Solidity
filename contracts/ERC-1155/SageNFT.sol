// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../Utils/StringUtils.sol";

contract SageNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721BurnableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes4 private constant INTERFACE_ID_ERC2981 = 0x2a55205a; // implements ERC-2981 interface

    // tokenId => collectionId
    mapping(uint256 => uint256) public tokenToCollection;

    // collectionId => collection info
    mapping(uint256 => CollectionInfo) public collections;

    event CollectionCreated(
        uint256 collectionId,
        address royaltyDestination,
        uint16 royaltyPercentage,
        string baseMetadataURI
    );
    struct CollectionInfo {
        uint16 royalty;
        address royaltyDestination;
        address primarySalesDestination;
        string dropMetadataURI;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Admin calls only");
        _;
    }

    function initialize(string calldata name, string calldata symbol)
        public
        initializer
    {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC721Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function getCollectionInfo(uint256 _collectionId)
        public
        view
        returns (
            address,
            uint16,
            string memory,
            address
        )
    {
        return (
            collections[_collectionId].royaltyDestination,
            collections[_collectionId].royalty,
            collections[_collectionId].dropMetadataURI,
            collections[_collectionId].primarySalesDestination
        );
    }

    function safeMint(
        address to,
        uint256 tokenId,
        uint256 collectionId
    ) public onlyRole(MINTER_ROLE) {
        tokenToCollection[tokenId] = collectionId;
        _safeMint(to, tokenId);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyAdmin
    {}

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721Upgradeable) {
        super._burn(tokenId);
    }

    function burnFromAuthorizedSC(uint256 id) public {
        require(hasRole(BURNER_ROLE, msg.sender), "NFT: No burn privileges");
        _burn(id);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable)
        returns (string memory)
    {
        return
            string.concat(
                collections[tokenToCollection[tokenId]].dropMetadataURI,
                StringUtils.uint2str(tokenId)
            );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return
            interfaceId == INTERFACE_ID_ERC2981 ||
            interfaceId == type(IAccessControlUpgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Creates a new collection.
     * @param _collectionId the collection id
     * @param _royaltyDestination the wallet address of the artist
     * @param _royaltyPercentage the royalty percentage in base points (200 = 2%)
     * @param _dropMetadataURI the metadata URI of the drop
     * @param _primarySalesDestination the wallet address to receive primary sales of the collection
     */
    function createCollection(
        uint256 _collectionId,
        address _royaltyDestination,
        uint16 _royaltyPercentage,
        string memory _dropMetadataURI,
        address _primarySalesDestination
    ) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Admin calls only");
        require(
            _royaltyDestination != address(0),
            "Royalty destination address can't be 0"
        );
        CollectionInfo memory collection = CollectionInfo(
            _royaltyPercentage,
            _royaltyDestination,
            _primarySalesDestination,
            _dropMetadataURI
        );

        collections[_collectionId] = collection;

        emit CollectionCreated(
            _collectionId,
            _royaltyDestination,
            _royaltyPercentage,
            _dropMetadataURI
        );
    }

    function collectionExists(uint256 _collectionId)
        public
        view
        returns (bool)
    {
        return collections[_collectionId].royaltyDestination != address(0);
    }

    /**
     * @notice Calculates royalties based on a sale price provided following EIP-2981.
     * Solution is agnostic of the sale price unit and will answer using the same unit.
     * @return  address to receive royaltyAmount, amount to be paid as royalty.
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address, uint256)
    {
        CollectionInfo storage collection = collections[
            tokenToCollection[tokenId]
        ];
        return (
            collection.royaltyDestination,
            (salePrice * collection.royalty) / 10000
        );
    }
}
