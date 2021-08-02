pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155Mintable is ERC1155("www."){
    string public name;
  // Contract symbol
    string public symbol;

    constructor(
        string memory _name,
        string memory _symbol
    ) public {
        name = _name;
        symbol = _symbol;
    }
}