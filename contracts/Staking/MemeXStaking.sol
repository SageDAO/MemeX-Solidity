pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IERC1155.sol";
import "./Pausable.sol";
import "../../interfaces/IRewards.sol";

contract PoolTokenWrapper {
    using SafeMath for uint256;
    IERC20 public token;

    constructor(IERC20 _erc20Address) public {
        token = IERC20(_erc20Address);
    }

    uint256 private _totalSupply;
    // Objects balances [id][address] => balance
    mapping(uint256 => mapping(address => uint256)) internal _balances;
    mapping(address => uint256) private _accountBalances;
    mapping(uint256 => uint256) private _poolBalances;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOfAccount(address account) public view returns (uint256) {
        return _accountBalances[account];
    }

    function balanceOfPool(uint256 id) public view returns (uint256) {
        return _poolBalances[id];
    }

    function balanceOf(address account, uint256 id)
        public
        view
        returns (uint256)
    {
        return _balances[id][account];
    }

    function stake(uint256 id, uint256 amount) public virtual {
        _totalSupply = _totalSupply.add(amount);
        _poolBalances[id] = _poolBalances[id].add(amount);
        _accountBalances[msg.sender] = _accountBalances[msg.sender].add(amount);
        _balances[id][msg.sender] = _balances[id][msg.sender].add(amount);
        token.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 id, uint256 amount) public virtual {
        _totalSupply = _totalSupply.sub(amount);
        _poolBalances[id] = _poolBalances[id].sub(amount);
        _accountBalances[msg.sender] = _accountBalances[msg.sender].sub(amount);
        _balances[id][msg.sender] = _balances[id][msg.sender].sub(amount);
        token.transfer(msg.sender, amount);
    }

    function transfer(
        uint256 fromId,
        uint256 toId,
        uint256 amount
    ) public virtual {
        _poolBalances[fromId] = _poolBalances[fromId].sub(amount);
        _balances[fromId][msg.sender] = _balances[fromId][msg.sender].sub(
            amount
        );

        _poolBalances[toId] = _poolBalances[toId].add(amount);
        _balances[toId][msg.sender] = _balances[toId][msg.sender].add(amount);
    }
}

contract MemeXStaking is PoolTokenWrapper, Ownable, Pausable {
    using SafeMath for uint256;

    struct Pool {
        uint256 periodStart;
        uint256 maxStake;
        uint256 rewardRate; // 11574074074000, 1 PINA per day per staked MEME
        IRewards rewardToken;
        uint256 controllerShare;
        address artist;
        mapping(address => uint256) lastUpdateTime;
        mapping(address => uint256) pinasToWithdraw;
    }

    address public controller;
    address public rescuer;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(uint256 => Pool) public pools;

    event UpdatedArtist(uint256 poolId, address artist);
    event PoolAdded(
        uint256 poolId,
        address artist,
        uint256 periodStart,
        uint256 rewardRate,
        IRewards rewardToken,
        uint256 maxStake
    );

    event Staked(address indexed user, uint256 poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 poolId, uint256 amount);
    event Transferred(
        address indexed user,
        uint256 fromPoolId,
        uint256 toPoolId,
        uint256 amount
    );

    modifier updateReward(address account, uint256 id) {
        if (account != address(0)) {
            pools[id].pinasToWithdraw[account] = earned(account, id);
            pools[id].lastUpdateTime[account] = block.timestamp;
        }
        _;
    }

    modifier poolExists(uint256 id) {
        require(pools[id].rewardRate > 0, "pool does not exists");
        _;
    }

    constructor(address _controller, IERC20 _tokenAddress)
        public
        PoolTokenWrapper(_tokenAddress)
    {
        controller = _controller;
    }

    function withdrawPinas(
        address account,
        uint256 pool,
        uint256 amount
    ) public {
        require(
            pools[pool].pinasToWithdraw[account] >= amount,
            "not enough pinas to withdraw"
        );
        pools[pool].pinasToWithdraw[account] = pools[pool]
            .pinasToWithdraw[account]
            .sub(amount);
        pools[pool].rewardToken.mintPinas(account, amount);
    }

    function earned(address account, uint256 pool)
        public
        view
        returns (uint256)
    {
        Pool storage p = pools[pool];
        uint256 blockTime = block.timestamp;
        return
            balanceOf(account, pool)
                .mul(blockTime.sub(p.lastUpdateTime[account]).mul(p.rewardRate))
                .div(1e8)
                .add(p.pinasToWithdraw[account]);
    }

    // override PoolTokenWrapper's stake() function
    function stake(uint256 pool, uint256 amount)
        public
        override
        poolExists(pool)
        updateReward(msg.sender, pool)
        whenNotPaused
    {
        Pool storage p = pools[pool];

        require(block.timestamp >= p.periodStart, "pool not open");
        require(
            amount.add(balanceOf(msg.sender, pool)) <= p.maxStake,
            "stake exceeds max"
        );

        super.stake(pool, amount);
        emit Staked(msg.sender, pool, amount);
    }

    // override PoolTokenWrapper's \draw() function
    function withdraw(uint256 pool, uint256 amount)
        public
        override
        poolExists(pool)
        updateReward(msg.sender, pool)
    {
        require(amount > 0, "cannot withdraw 0");

        super.withdraw(pool, amount);
        emit Withdrawn(msg.sender, pool, amount);
    }

    // override PoolTokenWrapper's transfer() function
    function transfer(
        uint256 fromPool,
        uint256 toPool,
        uint256 amount
    )
        public
        override
        poolExists(fromPool)
        poolExists(toPool)
        updateReward(msg.sender, fromPool)
        updateReward(msg.sender, toPool)
        whenNotPaused
    {
        Pool storage toP = pools[toPool];

        require(block.timestamp >= toP.periodStart, "pool not open");
        require(
            amount.add(balanceOf(msg.sender, toPool)) <= toP.maxStake,
            "stake exceeds max"
        );

        super.transfer(fromPool, toPool, amount);
        emit Transferred(msg.sender, fromPool, toPool, amount);
    }

    function setArtist(uint256 pool, address artist) public onlyOwner {
        uint256 amount = pendingWithdrawals[artist];
        pendingWithdrawals[artist] = 0;
        pendingWithdrawals[artist] = pendingWithdrawals[artist].add(amount);
        pools[pool].artist = artist;

        emit UpdatedArtist(pool, artist);
    }

    function setController(address _controller) public onlyOwner {
        uint256 amount = pendingWithdrawals[controller];
        pendingWithdrawals[controller] = 0;
        pendingWithdrawals[_controller] = pendingWithdrawals[_controller].add(
            amount
        );
        controller = _controller;
    }

    function setRescuer(address _rescuer) public onlyOwner {
        rescuer = _rescuer;
    }

    function setControllerShare(uint256 pool, uint256 _controllerShare)
        public
        onlyOwner
        poolExists(pool)
    {
        pools[pool].controllerShare = _controllerShare;
    }

    function createPool(
        uint256 id,
        uint256 periodStart,
        uint256 maxStake,
        uint256 rewardRate,
        IRewards rewardToken,
        uint256 controllerShare,
        address artist
    ) public onlyOwner {
        require(pools[id].rewardRate == 0, "pool exists");

        Pool storage p = pools[id];

        p.periodStart = periodStart;
        p.maxStake = maxStake;
        p.rewardRate = rewardRate;
        p.rewardToken = rewardToken;
        p.controllerShare = controllerShare;
        p.artist = artist;

        emit PoolAdded(
            id,
            artist,
            periodStart,
            rewardRate,
            rewardToken,
            maxStake
        );
    }

    function withdrawFee() public {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function isLiquidityProvider(address _address) public view returns (bool) {
        return false;
    }
}
