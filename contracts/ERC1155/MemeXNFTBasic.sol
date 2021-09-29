//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../Access/MemeXAccessControls.sol";

//TODO: Find out what proxy registry address is and implement it if required:ASK ET
//TODO: Add Access Control:DONE
//TODO: Add Lottery as admin?: Think
//TODO: Add Max Supply for each token! IMP:DONE
//TODO: Max Supply for Total Supply.
contract MemeXNFTBasic is ERC1155, MemeXAccessControls {
    using Strings for string;

    string public name;
    address public artist;
    uint8 public royaltyPercentage;

    mapping(uint256 => address) public creator;
    // Contract symbol
    string public symbol;
    address internal lotteryContract;
    bool private initialized;

    mapping(uint256 => uint256) tokenSupply;
    mapping(uint256 => uint256) public tokenMaxSupply;

    struct NFTInfo {
        uint256 lotteryId;
        address owner;
    }

    mapping(uint256 => NFTInfo) nftInfos;

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
        return tokenSupply[_id];
    }

    modifier creatorOnly(uint256 _id) {
        require(creator[_id] == msg.sender, "MemeXNFT: Creator Only");
        _;
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

    modifier onlyLottery() {
        require(
            msg.sender == address(lotteryContract),
            "Only Lottery contract can call"
        );
        _;
    }

    /**
     * @dev Creates a new token type and assigns _initialSupply to an address
     * @param _initialOwner address of the first owner of the token
     * @param _initialSupply amount to supply the first owner
     * @param _data Data to pass if receiver is contract
     * @return The newly created token ID
     */
    function create(
        address _initialOwner,
        uint256 _id,
        uint256 _initialSupply,
        uint256 _maxSupply,
        bytes calldata _data,
        uint256 _lotteryId
    ) external returns (uint256) {
        require(
            hasSmartContractRole(msg.sender) || hasMinterRole(msg.sender),
            "ERC1155.create only Lottery or Minter can create"
        );
        require(
            _initialSupply <= _maxSupply,
            "Initial supply cannot be more than max supply"
        );
        require(!exists(_id), "Token Id Already exists");
        creator[_id] = msg.sender;

        if (_initialSupply != 0)
            _mint(_initialOwner, _id, _initialSupply, _data);
        tokenSupply[_id] = _initialSupply;
        tokenMaxSupply[_id] = _maxSupply;
        nftInfos[_id] = NFTInfo(_lotteryId, _initialOwner);
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
        uint256 _quantity,
        bytes memory _data
    ) public {
        require(
            hasMinterRole(msg.sender),
            "ERC1155.mint: Only address having minter role can mint"
        );
        uint256 tokenId = _id;
        require(
            tokenSupply[tokenId] < tokenMaxSupply[tokenId],
            "Max supply reached"
        );
        _mint(_to, _id, _quantity, _data);
        tokenSupply[_id] = tokenSupply[_id] += _quantity;
    }

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public {
        require(
            hasMinterRole(msg.sender),
            "ERC1155.mint: Only address having minter role can mint"
        );

        require(
            _ids.length == _quantities.length,
            "MemeXNFT.batchMint: ids and quantities should be equal"
        );
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
            //SSS: Check if batch is required
            require(
                tokenSupply[_id] < tokenMaxSupply[_id],
                "Max supply reached"
            );
            uint256 quantity = _quantities[i];
            tokenSupply[_id] += quantity;
        }
        _mintBatch(_to, _ids, _quantities, _data);
    }

    ///SSS: Dont need this
    // function _getNextTokenID() private view returns (uint256) {
    //     return _currentTokenID.add(1);
    // }

    // function _incrementTokenTypeId() private  {
    //     _currentTokenID++;
    // }

    function getNFTOwner(uint256 _id) public view returns (address) {
        return nftInfos[_id].owner;
    }

    function setBaseMetadataURI(string memory _newBaseMetadataURI)
        public
        onlyLottery
    {
        _setURI(_newBaseMetadataURI);
    }

    function exists(uint256 _id) public view returns (bool) {
        return creator[_id] != address(0);
    }

    function setRoyaltyPercentage(uint8 _percentage) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change royalties"
        );
        require(
            _percentage <= 10000,
            "MemeXNFT: Percentage should be less than 10000"
        );
        royaltyPercentage = _percentage;
    }

    function setArtist(address _artist) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change artist"
        );
        artist = _artist;
    }

    /**
     * @notice Calculates royalties based on a sale price provided.
     * Solution is agnostic of the sale price unit and will answer using the same unit.
     * @return  receiver address: address to receive royaltyAmount.
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        return (artist, (salePrice * royaltyPercentage) / 10000);
    }
}
