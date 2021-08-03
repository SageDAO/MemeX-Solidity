pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
//import "@openzeppelin/contracts/ownership/Ownable.sol";

contract ERC1155Mintable is ERC1155("www."){
    using SafeMath for uint256;
    string public name;
    // Contract symbol
    string public symbol;
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    
    mapping (uint256 => address) public creators;
    mapping (uint256 => uint256) public tokenSupply;
    
    

    constructor(
        string memory _name,
        string memory _symbol
    ) public {
        name = _name;
        symbol = _symbol;
    }


    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
        ) public  {
            _mint(_to, _id, _quantity, _data);
            tokenSupply[_id] = tokenSupply[_id].add(_quantity);
    }

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
        ) public {
            for (uint256 i = 0; i < _ids.length; i++) {
                uint256 _id = _ids[i];
                require(creators[_id] == msg.sender, "ERC1155Tradable#batchMint: ONLY_CREATOR_ALLOWED");
                uint256 quantity = _quantities[i];
                tokenSupply[_id] = tokenSupply[_id].add(quantity);
        }
            _mintBatch(_to, _ids, _quantities, _data);
    } 

    function uri(uint256 _id) public override view returns (string memory) {
        return string(abi.encodePacked(super.uri(_id), toHexString(_id), ".json"));
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