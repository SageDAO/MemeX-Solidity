pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./String.sol";


//TODO: Refractor the code to align with requirements
//TODO: Think if we want another contract that inherits from this
//TODO: Find out what proxy registry address is and implement it if required
//TODO: Add Access Control
contract MemeXNFT is Ownable, ERC1155 {
    using SafeMath for uint256;
    using Strings for string;

    uint256 private _currentTokenID = 0;

    string public name;
    mapping(uint256 => address) public creators;
    // Contract symbol
    string public symbol;
    address internal lotteryContract;
    bool private initialized;

    mapping(uint256 => uint256) tokenSupply;

   

    event LotteryContractUpdated(
        address oldLotteryContract,
        address newLotteryContract
    );

    event CreatorUpdated(address oldCreator, address newCreator);


    modifier creatorOnly(uint256 _id) {
        require(creators[_id] == msg.sender, "ERC1155Tradable#creatorOnly: ONLY_CREATOR_ALLOWED");
    _   ;
    }

    constructor()ERC1155("") {

    }
    
    function initNFT(
        string memory _name,
        string memory _symbol,
        address _lotteryContract
        ) public{
           // setBaseMetadataURI(_baseUri);
           require(!initialized,"MemeXNFT: Already intialized");
            name = _name;
            symbol = _symbol;
            lotteryContract = _lotteryContract;
            initialized = true;
    }

    function setLotteryContract(address _lotteryContract) public onlyOwner {
        require(_lotteryContract != address(0));
        address oldAddr = address(lotteryContract);
        lotteryContract = _lotteryContract;
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
        * @param _uri Optional URI for this token type
        * @param _data Data to pass if receiver is contract
        * @return The newly created token ID
    */
    function create(
        address _initialOwner,
        uint256 _initialSupply,
        string calldata _uri,
        bytes calldata _data
    ) external onlyLottery returns (uint256) {
        uint256 _id = _getNextTokenID();
        _incrementTokenTypeId();
        creators[_id] = msg.sender;

        if (bytes(_uri).length > 0) {
            emit URI(_uri, _id);
        }

        _mint(_initialOwner, _id, _initialSupply, _data);
        tokenSupply[_id] = _initialSupply;
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
    ) public creatorOnly(_id) {
        _mint(_to, _id, _quantity, _data);
        tokenSupply[_id] = tokenSupply[_id].add(_quantity);
    }   

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public onlyLottery {
        require(_ids.length == _quantities.length, "MemeXNFT.batchMint: ids and quantities should be equal");
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
            require(creators[_id] == msg.sender, "MemeXNFT.batchMint: Only creators are allowed to batch mint");
            uint256 quantity = _quantities[i];
            tokenSupply[_id] += quantity;
        }
        _mintBatch(_to, _ids, _quantities, _data);
    }


    function setCreator(
        address _to,
        uint256[] memory _ids
    ) public {
        require(_to != address(0), "MemeXNFT.setCreator: _to Cannot be null");
        for (uint256 i = 0; i < _ids.length; i++) {
        uint256 id = _ids[i];
        _setCreator(_to, id);
    }
  }


    function _getNextTokenID() private view returns (uint256) {
        return _currentTokenID.add(1);
    }

    function _incrementTokenTypeId() private  {
        _currentTokenID++;
    }


    function _setCreator(address _to, uint256 _id) internal creatorOnly(_id){   
        require(creators[_id] == msg.sender, "MemeXNFT._setCreator: Only creators are allowed to change creator");
        creators[_id] = _to;
        address oldCreator = msg.sender;
        emit CreatorUpdated(oldCreator, creators[_id]);
    }


    function setBaseMetadataURI(string memory _newBaseMetadataURI)
        public
        onlyLottery{
        _setURI(_newBaseMetadataURI);
    }

   
    function _exists(uint256 _id) internal view returns (bool) {
        return creators[_id] != address(0);
    }
}
