//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

import "../Access/MemeXAccessControls.sol";
import "../Utils/StringUtils.sol";
import "../../interfaces/IMemeXNFT.sol";

contract MemeXNFT is ERC1155Supply, MemeXAccessControls, IMemeXNFT {
    uint256 public collectionCount;

    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    string public name;
    // Contract symbol
    string public symbol;

    // tokenId => collectionId
    mapping(uint256 => uint256) public tokenToCollection;

    // collectionId => collection info
    mapping(uint256 => CollectionInfo) public collections;

    // collectionId => array of NFT ids
    mapping(uint256 => uint256[]) public nftsInCollection;

    event CollectionCreated(
        uint256 collectionId,
        address artistAddress,
        uint16 royaltyPercentage,
        string baseMetadataURI
    );
    struct CollectionInfo {
        address artistAddress;
        uint16 royalty;
        string dropMetadataURI;
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
            interfaceId == _INTERFACE_ID_ERC2981 ||
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
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

    function getCollectionInfo(uint256 _collectionId)
        public
        view
        returns (
            address,
            uint16,
            string memory
        )
    {
        return (
            collections[_collectionId].artistAddress,
            collections[_collectionId].royalty,
            collections[_collectionId].dropMetadataURI
        );
    }

    /**
     * @notice Changes information about a collection (drop).
     * @param _collectionId the collectionId
     * @param _artistAddress the wallet address of the artist
     * @param _royaltyPercentage the royalty percentage in base points (200 = 2%)
     * @param _dropMetadataURI the metadata URI of the drop
     */
    function setCollection(
        uint256 _collectionId,
        address _artistAddress,
        uint16 _royaltyPercentage,
        string memory _dropMetadataURI
    ) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can set collection info"
        );
        require(_artistAddress != address(0));
        collections[_collectionId].artistAddress = _artistAddress;
        collections[_collectionId].royalty = _royaltyPercentage;
        collections[_collectionId].dropMetadataURI = _dropMetadataURI;
    }

    /**
     * @notice Creates a new collection (drop).
     * @param _artistAddress the wallet address of the artist
     * @param _royaltyPercentage the royalty percentage in base points (200 = 2%)
     * @param _dropMetadataURI the metadata URI of the drop
     */
    function createCollection(
        address _artistAddress,
        uint16 _royaltyPercentage,
        string memory _dropMetadataURI
    ) external returns (uint256) {
        require(
            hasAdminRole(msg.sender) || hasSmartContractRole(msg.sender),
            "ERC1155.createCollection only Admin or Minter can create"
        );
        require(_artistAddress != address(0), "Artist address can't be 0");
        CollectionInfo memory collection = CollectionInfo(
            _artistAddress,
            _royaltyPercentage,
            _dropMetadataURI
        );
        incrementCollectionCount();
        collections[collectionCount] = collection;

        emit CollectionCreated(
            collectionCount,
            _artistAddress,
            _royaltyPercentage,
            _dropMetadataURI
        );
        return collectionCount;
    }

    function collectionExists(uint256 _collectionId)
        public
        view
        returns (bool)
    {
        return _collectionId != 0 && _collectionId < collectionCount;
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
        uint256 _collectionId,
        bytes memory _data
    ) public {
        require(
            hasSmartContractRole(msg.sender) || hasMinterRole(msg.sender),
            "MemeXNFT: Only Lottery or Minter role can mint"
        );
        tokenToCollection[_id] = _collectionId;
        nftsInCollection[_collectionId].push(_id);
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

    function uri(uint256 _id) public view override returns (string memory) {
        require(exists(_id), "NONEXISTENT_TOKEN");
        // fetch base URI for this collection
        string memory baseURI = collections[tokenToCollection[_id]]
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
            tokenToCollection[tokenId]
        ];
        return (
            collection.artistAddress,
            (salePrice * collection.royalty) / 10000
        );
    }

    function burn(
        address account,
        uint256 id,
        uint256 value
    ) public virtual {
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        _burn(account, id, value);
    }

    function burnBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory values
    ) public virtual {
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        _burnBatch(account, ids, values);
    }
}
