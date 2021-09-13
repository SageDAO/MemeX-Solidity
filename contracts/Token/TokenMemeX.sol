pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

import "../Access/MemeXAccessControls.sol";

//TODO: What should be MAX CAP?
//TODO: Should it be mintable
contract MemeXToken is ERC20, MemeXAccessControls{

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) ERC20(name, symbol) {
        _mint(owner, initialSupply * (10**decimals()));
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }


    function mint(address to, uint256 amount) public virtual {
        require(hasMinterRole(msg.sender), "MintableToken: must have minter role to mint");
        _mint(to, amount * (10 ** decimals()));
    }
}


