//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../Access/MemeXAccessControls.sol";

contract MemeXNFT is ERC1155, MemeXAccessControls {
    using Strings for string;
    string internal baseMetadataURI;

    uint16 public constant maxRoyalty = 2000;

    string public name;
    // Contract symbol
    string public symbol;

    address internal lotteryContract;

    // artist address => royalty percentage stored as basis points. e.g. 10% = 1000
    mapping(address => uint16) public royalties;

    // tokenId => token Info
    mapping(uint256 => TokenInfo) public tokenInfo;

    // collectionId => collection base metadata URI
    mapping(uint256 => string) public dropMetadataURI;

    struct TokenInfo {
        address artistAddress;
        uint32 tokenSupply;
        uint32 tokenMaxSupply;
        uint256 collectionId;
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

    event LotteryContractUpdated(
        address oldLotteryContract,
        address newLotteryContract
    );

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

    function setLotteryContract(address _lotteryContract) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change lottery address"
        );
        require(_lotteryContract != address(0));
        address oldAddr = address(lotteryContract);
        lotteryContract = _lotteryContract;
        addSmartContractRole(lotteryContract);
        emit LotteryContractUpdated(oldAddr, lotteryContract);
    }

    function mint(
        address _to,
        uint256 _id,
        bytes calldata _data
    ) public {
        TokenInfo storage token = tokenInfo[_id];
        require(
            hasSmartContractRole(msg.sender) || hasMinterRole(msg.sender),
            "ERC1155.create only Lottery or Minter can mint"
        );
        require(token.tokenSupply < token.tokenMaxSupply, "Max supply reached");
        token.tokenSupply = token.tokenSupply++;
        _mint(_to, _id, 1, _data);
    }

    /**
     * @dev Creates a new token type and assigns _initialSupply to an address
     * @param _maxSupply maximum amount of tokens that can be created
     * @param _artistAddress address of the artist, used to answer royalty requests
     * @return The newly created token ID
     */
    function create(
        uint256 _id,
        uint32 _maxSupply,
        uint256 _lotteryId,
        address _artistAddress
    ) external returns (uint256) {
        require(
            hasSmartContractRole(msg.sender) || hasMinterRole(msg.sender),
            "ERC1155.create only Lottery or Minter can create"
        );
        require(_maxSupply > 0, "Max supply can't be 0");
        require(!exists(_id), "Token Id Already exists");
        TokenInfo memory token = TokenInfo(
            _artistAddress,
            0,
            _maxSupply,
            _lotteryId
        );
        tokenInfo[_id] = token;
        return _id;
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
            "ERC1155.mint: Only lottery or minter role can mint"
        );
        TokenInfo storage token = tokenInfo[_id];
        require(
            token.tokenSupply + _quantity <= token.tokenMaxSupply,
            "Max supply reached"
        );
        token.tokenSupply += _quantity;
        _mint(_to, _id, _quantity, _data);
    }

    function _setBaseMetadataURI(string memory _newBaseMetadataURI) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change metadata"
        );
        baseMetadataURI = _newBaseMetadataURI;
    }

    function setCollectionBaseMetadataURI(
        uint256 _collectionId,
        string memory _newBaseMetadataURI
    ) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change metadata"
        );
        dropMetadataURI[_collectionId] = _newBaseMetadataURI;
    }

    function exists(uint256 _id) public view returns (bool) {
        return tokenInfo[_id].tokenMaxSupply != 0;
    }

    function uri(uint256 _id) public view override returns (string memory) {
        require(exists(_id), "NONEXISTENT_TOKEN");
        // fetch URI valid for this collection
        string memory baseURI = dropMetadataURI[tokenInfo[_id].collectionId];

        if (bytes(baseURI).length == 0) {
            baseURI = baseMetadataURI;
        }
        return string(abi.encodePacked(baseURI, _id));
    }

    function setRoyaltyPercentage(address artist, uint16 _percentage) public {
        require(
            hasAdminRole(msg.sender) || msg.sender == artist,
            "MemeXNFT: Only Admin or artist can change royalties"
        );
        require(
            _percentage <= maxRoyalty,
            "MemeXNFT: Percentage exceeds limit"
        );
        royalties[artist] = _percentage;
    }

    function setArtist(uint256 _id, address _artist) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change artist"
        );
        tokenInfo[_id].artistAddress = _artist;
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
        TokenInfo memory token = tokenInfo[tokenId];
        require(
            token.artistAddress != address(0),
            "MemeXNFT: Artist address not set"
        );
        return (
            token.artistAddress,
            (salePrice * royalties[token.artistAddress]) / 10000
        );
    }
}
