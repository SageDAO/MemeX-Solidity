pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../Access/MemeXAccessControls.sol";


import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";

//TODO: Find out what proxy registry address is and implement it if required
//TODO: Add Access Control
//TODO: Add Lottery as admin?
//TODO: Add Max Supply! IMP
contract MemeXNFT is Ownable, ERC1155, MemeXAccessControls {
    using SafeMath for uint256;
    using Strings for string;


    string public name;
    mapping(uint256 => address) public creator;
    // Contract symbol
    string public symbol;
    address internal lotteryContract;
    bool private initialized;

    mapping(uint256 => uint256) tokenSupply;

   function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC1155) returns (bool) {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
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
        uint256 _id,
        uint256 _initialSupply,
        string calldata _uri,
        bytes calldata _data
    ) external onlyLottery returns (uint256) {
        require(!_exists(_id),"Token Id Already exists");
        creator[_id] = msg.sender;

        if (bytes(_uri).length > 0) {
            emit URI(_uri, _id);
        }

        if (_initialSupply != 0) _mint(_initialOwner, _id, _initialSupply, _data);
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
    ) public {
        require(hasMinterRole(msg.sender), "ERC1155.mint: Only address having minter role can mint");
        _mint(_to, _id, _quantity, _data);
        tokenSupply[_id] = tokenSupply[_id].add(_quantity);
    }   

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public {
        require(hasMinterRole(msg.sender), "ERC1155.mint: Only address having minter role can mint");
        require(_ids.length == _quantities.length, "MemeXNFT.batchMint: ids and quantities should be equal");
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
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




    function setBaseMetadataURI(string memory _newBaseMetadataURI)
        public
        onlyLottery{
        _setURI(_newBaseMetadataURI);
    }

   
    function _exists(uint256 _id) internal view returns (bool) {
        return creator[_id] != address(0);
    }
}
