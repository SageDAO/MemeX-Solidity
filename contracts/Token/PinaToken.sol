//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

/**
    This contract is used to simulate the use of a reward token and currently won't be used in production.
 */
contract PinaToken is ERC20Burnable, Ownable {
    address rewardsContract;
    address lotteryContract;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner,
        address _rewardsContract
    ) ERC20(name, symbol) {
        rewardsContract = _rewardsContract;
        if (initialSupply != 0) {
            _mint(owner, initialSupply);
        }
    }

    modifier onlyRewardsContract() {
        require(msg.sender == address(rewardsContract), "Only Stake address");
        _;
    }

    modifier onlyLotteryContract() {
        require(msg.sender == address(lotteryContract), "Only Lottery address");
        _;
    }

    function setRewardsContract(address _rewardsContract) public onlyOwner {
        rewardsContract = _rewardsContract;
    }

    function setLotteryContract(address _lotteryContract) public onlyOwner {
        lotteryContract = _lotteryContract;
    }

    function getRewardsContract() public view returns (address) {
        return rewardsContract;
    }

    function getLotteryContract() public view returns (address) {
        return lotteryContract;
    }

    function mint(address recipient, uint256 amount)
        external
        onlyRewardsContract
    {
        _mint(recipient, amount);
    }

    function burn(address account, uint256 amount)
        external
        onlyLotteryContract
    {
        _burn(account, amount);
    }
}
