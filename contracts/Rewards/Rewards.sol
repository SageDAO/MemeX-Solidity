//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";

contract Rewards is Ownable {
    address public lotteryAddr;

    uint256 public rewardRateToken;
    uint256 public rewardRateLiquidity;

    struct UserInfo {
        uint256 memeOnWallet;
        uint256 liquidityOnWallet;
        uint256 lastSnapshotTime;
        uint256 pointsAvailableSnapshot;
    }
    mapping(address => UserInfo) public userInfo;

    event PointsUsed(address indexed user, uint256 amount, uint256 remaining);
    event BalanceChanged(
        address indexed user,
        uint256 amountMeme,
        uint256 amountLiquidity
    );

    modifier onlyLottery() {
        require(msg.sender == lotteryAddr, "Lottery calls only");
        _;
    }

    modifier updateReward(address account) {
        UserInfo storage user = userInfo[account];
        user.pointsAvailableSnapshot = pointsAvailable(account);
        user.lastSnapshotTime = block.timestamp;
        _;
    }

    constructor(uint256 _rewardRateToken, uint256 _rewardRateLiquidity) {
        rewardRateToken = _rewardRateToken;
        rewardRateLiquidity = _rewardRateLiquidity;
    }

    function setLotteryAddress(address _lotteryAddr) public onlyOwner {
        lotteryAddr = _lotteryAddr;
    }

    function setRewardRateToken(uint256 _rewardRateToken) public onlyOwner {
        rewardRateToken = _rewardRateToken;
    }

    function setRewardRateLiquidity(uint256 _rewardRateLiquidity)
        public
        onlyOwner
    {
        rewardRateLiquidity = _rewardRateLiquidity;
    }

    function pointsAvailable(address _account) public view returns (uint256) {
        UserInfo memory user = userInfo[_account];
        require(user.lastSnapshotTime > 0, "User snapshot not available");
        uint256 blockTime = block.timestamp;
        uint256 pointsToken = ((user.memeOnWallet) *
            (blockTime - user.lastSnapshotTime) *
            rewardRateToken);
        uint256 pointsLiquidity = ((user.liquidityOnWallet) *
            (blockTime - user.lastSnapshotTime) *
            rewardRateLiquidity);
        return pointsToken + pointsLiquidity + user.pointsAvailableSnapshot;
    }

    function burnUserPoints(address _account, uint256 _amount)
        public
        onlyLottery
        updateReward(_account)
        returns (uint256)
    {
        require(_amount > 0, "cannot use 0 points");
        UserInfo storage user = userInfo[_account];
        require(_amount <= user.pointsAvailableSnapshot, "not enough points");
        uint256 remainingPoints = user.pointsAvailableSnapshot - _amount;
        user.pointsAvailableSnapshot = remainingPoints;

        emit PointsUsed(_account, _amount, remainingPoints);
        return remainingPoints;
    }

    function updateUserBalance(
        address _account,
        uint256 _tokenBalance,
        uint256 _liquidityBalance
    ) public onlyOwner updateReward(_account) {
        UserInfo storage user = userInfo[_account];
        user.memeOnWallet = _tokenBalance;
        user.liquidityOnWallet = _liquidityBalance;
        emit BalanceChanged(_account, _tokenBalance, _liquidityBalance);
    }

    function updateBalanceBatch(
        address[] calldata _accounts,
        uint256[] calldata _tokenBalances,
        uint256[] calldata _liquidityBalances
    ) public onlyOwner {
        require(
            _accounts.length == _tokenBalances.length &&
                _accounts.length == _liquidityBalances.length,
            "accounts and balances must be the same length"
        );
        for (uint256 i = 0; i < _accounts.length; i++) {
            updateUserBalance(
                _accounts[i],
                _tokenBalances[i],
                _liquidityBalances[i]
            );
        }
    }
}
