pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";

contract Token is ERC777 {
    constructor(address[] memory defaultOperators)
        public
        ERC777("MemeX", "MEMEX", defaultOperators)
    {
        _mint(msg.sender, 10000000000, "", "");
    }
}