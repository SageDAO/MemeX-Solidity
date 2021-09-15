pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IERC1155.sol";
import "./Pausable.sol";
import "../../interfaces/IRewards.sol";

contract Rewards is Ownable, Pausable {
    IERC20 memeAddress;
    IERC20 liquidityAddress;
    address internal lotteryAddr;

    uint256 rewardRateToken;
    uint256 rewardRateLiquidity;
    IRewards addressOfRewardToken;

    address[] userList;

    struct UserInfo {
        uint256 memeOnWallet;
        uint256 liquidityOnWallet;
        uint256 lastSnapshotTime;
        uint256 pointsAvailableSnapshot;
    }
    mapping(address => UserInfo) userInfo;

    event Joined(
        address indexed user,
        uint256 amountToken,
        uint256 amountLiquidity
    );
    event PointsUsed(address indexed user, uint256 amount);
    event ClaimedTokenReward(address indexed user, uint256 amount);

    modifier updateReward(address account) {
        UserInfo storage user = userInfo[account];
        require(user.lastSnapshotTime >= 0, "User didn't join Memex yet");
        user.pointsAvailableSnapshot = earned(account);
        user.lastSnapshotTime = block.timestamp;
        _;
    }

    modifier onlyLottery() {
        require(msg.sender == lotteryAddr, "Lottery calls only");
        _;
    }

    constructor(
        IERC20 _memeAddress,
        IERC20 _liquidityAddress,
        uint256 _rewardRateToken,
        uint256 _rewardRateLiquidity
    ) public {
        memeAddress = _memeAddress;
        liquidityAddress = _liquidityAddress;
        rewardRateToken = _rewardRateToken;
        rewardRateLiquidity = _rewardRateLiquidity;
    }

    function setLotteryAddress(address _lotteryAddr) public onlyOwner {
        lotteryAddr = _lotteryAddr;
    }

    function getRewardRateToken() public view returns (uint256) {
        return rewardRateToken;
    }

    function getRewardRateLiquidity() public view returns (uint256) {
        return rewardRateLiquidity;
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

    function setMemeAddresS(IERC20 _memeAddress) public onlyOwner {
        memeAddress = _memeAddress;
    }

    function setLiquidityAddress(IERC20 _liquidityAddress) public onlyOwner {
        liquidityAddress = _liquidityAddress;
    }

    function getUserInfo(address _user) public view returns (UserInfo memory) {
        return userInfo[_user];
    }

    function claimTokenReward(address account) public updateReward(msg.sender) {
        require(
            address(addressOfRewardToken) != address(0),
            "Cannot claim token. Rewards are only points so far"
        );
        UserInfo storage user = userInfo[account];
        require(user.pointsAvailableSnapshot > 0, "no pinas to withdraw");
        uint256 pinas = user.pointsAvailableSnapshot;
        user.pointsAvailableSnapshot = 0;
        user.lastSnapshotTime = block.timestamp;
        addressOfRewardToken.mintPinas(account, pinas);
        emit ClaimedTokenReward(account, pinas);
    }

    function getRewardToken() public view returns (IRewards) {
        return addressOfRewardToken;
    }

    function updateUserBalance(
        address account,
        uint256 tokenBalance,
        uint256 liquidityBalance
    ) public onlyOwner updateReward(account) {
        UserInfo storage user = userInfo[account];
        user.memeOnWallet = tokenBalance;
        user.liquidityOnWallet = liquidityBalance;
    }

    function updateUserRewards(address account, uint256 rewards)
        public
        onlyOwner
        updateReward(account)
    {
        UserInfo storage user = userInfo[account];
        user.pointsAvailableSnapshot = rewards;
    }

    function earned(address account) public view returns (uint256) {
        UserInfo memory user = userInfo[account];
        require(user.lastSnapshotTime > 0, "User didn't join Memex yet");
        uint256 blockTime = block.timestamp;
        uint256 pointsToken = (user.memeOnWallet / 1e8) * // divide by the decimals of the token used
            (blockTime - user.lastSnapshotTime) *
            rewardRateToken;
        uint256 pointsLiquidity = (user.liquidityOnWallet / 1e8) *
            (// divide by the decimals of the token used
            blockTime - user.lastSnapshotTime) *
            rewardRateLiquidity;
        return pointsToken + pointsLiquidity + user.pointsAvailableSnapshot;
    }

    function userJoined() public view returns (bool) {
        return userInfo[msg.sender].lastSnapshotTime != 0;
    }

    function getUserList() public view returns (address[] memory) {
        return userList;
    }

    function join() public whenNotPaused {
        require(
            userInfo[msg.sender].lastSnapshotTime == 0,
            "User already joined"
        );
        userList.push(msg.sender);
        uint256 memeBalance = memeAddress.balanceOf(msg.sender);
        uint256 liquidityBalance = liquidityAddress.balanceOf(msg.sender);
        require(
            memeBalance > 0 || liquidityBalance > 0,
            "MEME or MEMELP position required to join"
        );
        UserInfo memory user = UserInfo(
            memeBalance,
            liquidityBalance,
            block.timestamp,
            0
        );
        userInfo[msg.sender] = user;
        emit Joined(msg.sender, memeBalance, liquidityBalance);
    }

    function burnUserPoints(address account, uint256 amount)
        public
        onlyLottery
        updateReward(account)
    {
        require(amount > 0, "cannot use 0 points");
        UserInfo storage user = userInfo[account];
        require(amount <= user.pointsAvailableSnapshot, "not enough points");
        user.pointsAvailableSnapshot = user.pointsAvailableSnapshot - amount;

        emit PointsUsed(account, amount);
    }
}
