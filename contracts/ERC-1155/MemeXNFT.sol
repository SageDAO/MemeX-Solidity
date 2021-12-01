//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../Access/MemeXAccessControls.sol";
import "../Utils/StringUtils.sol";

contract MemeXNFT is ERC1155, MemeXAccessControls {
    uint256 public collectionCount;

    uint16 public defaultRoyaltyPercentage = 200;

    string public name;
    // Contract symbol
    string public symbol;

    // tokenId => token Info
    mapping(uint256 => TokenInfo) public tokenInfo;

    // collectionId => collection info
    mapping(uint256 => CollectionInfo) public collections;

    // collectionId => array of NFT ids
    mapping(uint256 => uint256[]) public nftsInCollection;

    struct CollectionInfo {
        address artistAddress;
        uint16 royalty;
        string dropMetadataURI;
    }

    struct DropInfo {
        uint256 firstId;
        uint256 lastId;
        
    }

    struct TokenInfo {
        uint32 tokenSupply;
        uint32 tokenMaxSupply;
        uint256 collectionId;
    }

    function incrementCollectionCount() internal {
        collectionCount++;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC1155)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function totalSupply(uint256 _id) public view returns (uint256) {
        return tokenInfo[_id].tokenSupply;
    }

    function maxSupply(uint256 _id) public view returns (uint256) {
        return tokenInfo[_id].tokenMaxSupply;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _admin
    ) ERC1155("") {
        name = _name;
        symbol = _symbol;
        initAccessControls(_admin);
    }

    function setCollection(
        uint256 _collectionId,
        address _artistAddress,
        uint16 _royalty,
        string memory _dropMetadataURI
    ) public {
        require(
            hasAdminRole(msg.sender) ||
                msg.sender == collections[_collectionId].artistAddress,
            "MemeXNFT: Only Admin can set collection info"
        );
        require(_artistAddress != address(0));
        collections[_collectionId].artistAddress = _artistAddress;
        collections[_collectionId].royalty = _royalty;
        collections[_collectionId].dropMetadataURI = _dropMetadataURI;
    }

    /**
     * @dev Creates a new token type
     * @param _maxSupply maximum amount of tokens that can be created
     * @param _collectionId identifies the drop collection (lotteryId for lotteries)
     */
    function createTokenType(
        uint256 _id,
        uint32 _maxSupply,
        uint256 _collectionId
    ) external {
        require(
            hasAdminRole(msg.sender) ||
                hasSmartContractRole(msg.sender) ||
                hasMinterRole(msg.sender),
            "ERC1155.create only Lottery or Minter can create"
        );
        require(_maxSupply > 0, "Max supply can't be 0");
        require(!exists(_id), "Token Id Already exists");
        TokenInfo memory token = TokenInfo(0, _maxSupply, _collectionId);
        tokenInfo[_id] = token;
    }

    function createCollection(
        address _artistAddress,
        string memory _dropMetadataURI
    ) external returns (uint256) {
        require(
            hasAdminRole(msg.sender) || hasSmartContractRole(msg.sender),
            "ERC1155.createCollection only Admin or Minter can create"
        );
        require(_artistAddress != address(0), "Artist address can't be 0");
        CollectionInfo memory collection = CollectionInfo(
            _artistAddress,
            defaultRoyaltyPercentage,
            _dropMetadataURI
        );
        incrementCollectionCount();
        collections[collectionCount] = collection;
        return collectionCount;
    }

    /**
     * @dev Mints some amount of tokens to an address
     * @param _to          Address of the future owner of the token
     * @param _id          Token ID to mint
     * @param _quantity    Amount of tokens to mint
     * @param _data        Data to pass if receiver is contract
     */
    function mint(
        address _to,
        uint256 _id,
        uint32 _quantity,
        bytes memory _data
    ) public {
        require(
            hasSmartContractRole(msg.sender) || hasMinterRole(msg.sender),
            "MemeXNFT: Only Lottery or Minter role can mint"
        );
        TokenInfo storage token = tokenInfo[_id];
        require(
            token.tokenSupply + _quantity <= token.tokenMaxSupply,
            "Max supply reached"
        );
        token.tokenSupply += _quantity;
        _mint(_to, _id, _quantity, _data);
    }

    function setCollectionBaseMetadataURI(
        uint256 _collectionId,
        string memory _newBaseMetadataURI
    ) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change metadata"
        );
        collections[_collectionId].dropMetadataURI = _newBaseMetadataURI;
    }

    function exists(uint256 _id) public view returns (bool) {
        return tokenInfo[_id].tokenMaxSupply != 0;
    }

    function uri(uint256 _id) public view override returns (string memory) {
        require(exists(_id), "NONEXISTENT_TOKEN");
        // fetch base URI for this collection
        string memory baseURI = collections[tokenInfo[_id].collectionId]
            .dropMetadataURI;

        return StringUtils.strConcat(baseURI, StringUtils.uint2str(_id));
    }

    /**
     * @notice Calculates royalties based on a sale price provided following EIP-2981.
     * Solution is agnostic of the sale price unit and will answer using the same unit.
     * @return  receiver address: address to receive royaltyAmount.
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        CollectionInfo memory collection = collections[
            tokenInfo[tokenId].collectionId
        ];
        return (
            collection.artistAddress,
            (salePrice * collection.royalty) / 10000
        );
    }
}
