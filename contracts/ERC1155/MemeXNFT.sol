pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
//import "@openzeppelin/contracts/ownership/Ownable.sol";

contract MemeXNFT is ERC1155(""){
    using SafeMath for uint256;
    string public name;
    // Contract symbol
    string public symbol;
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    address internal lotteryContract;

    address public owner;
    mapping(uint256 => uint256) tokenSupply;

    
    struct NFTInfo{
        address owner;
        bool minted;
        uint256 lotteryId;
    }

    mapping(uint256 => NFTInfo) internal nftInfo;
    
    
    event LotteryContractUpdated(address oldLotteryContract, address newLotteryContract);
    

    constructor(
        string memory _name,
        string memory _symbol
    ) public {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    // add owner
    function setLotteryContract(address _lotteryContract) public  {
        require(owner == msg.sender);
        require(lotteryContract != address(0));
        lotteryContract = _lotteryContract;
        oldAddrr = address(lotteryContract);
        emit LotteryContractUpdated(oldAddr, lotteryContract);

    }

    ///@dev use this function to mint the tokens with lottery contract
    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data,
        uint256 _lotteryId
        ) public  {
            require(msg.sender == lotteryContract,"Only lottery contract can mint");
            _mint(_to, _id, _quantity, _data);
            tokenSupply[_id] = tokenSupply[_id].add(_quantity);

            nftInfo(_id) = NFTInfo(
                _to,
                true,
                _lotteryId
            );
    }       

    
    
    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public {
        for (uint256 i = 0; i< _ids.length; i++){
            uint256 _id = _ids[i];
            uint256 quantity = _quantities[i];
            tokenSupply[_id] =  tokenSupply[_id].add(quantity);

        }
        _batchMint(_to, _ids, _quantities, _data);
    }

    function getLotteryId(uint256 _tokenId) public view{
            return nftInfo(_tokenId)._lotteryId;
    }

      /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
    

    

}