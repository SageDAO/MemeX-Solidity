pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract PinaToken is ERC20Burnable, Ownable {
    address stakeContract;
    address lotteryContract;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner,
        address _stakeContract
    ) ERC20(name, symbol) {
        stakeContract = _stakeContract;
        if (initialSupply != 0) {
            _mint(owner, initialSupply);
        }
    }

    modifier onlyStakeContract() {
        require(msg.sender == address(stakeContract), "Only Stake address");
        _;
    }

    modifier onlyLotteryContract() {
        require(msg.sender == address(lotteryContract), "Only Lottery address");
        _;
    }

    function setStakeContract(address _stakeContract) public onlyOwner {
        stakeContract = _stakeContract;
    }

    function setLotteryContract(address _lotteryContract) public onlyOwner {
        lotteryContract = _lotteryContract;
    }

    function getStakeContract() public view returns (address) {
        return stakeContract;
    }

    function getLotteryContract() public view returns (address) {
        return lotteryContract;
    }

    function mintPinas(address recipient, uint256 amount)
        external
        onlyStakeContract
    {
        _mint(recipient, amount);
    }

    function burnPinas(address account, uint256 amount)
        external
        onlyLotteryContract
    {
        _burn(account, amount);
    }
}
