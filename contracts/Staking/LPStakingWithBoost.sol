pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IERC1155.sol";
import "./Pausable.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IUniswapV2Pair.sol";

//TODO: Check if rewards are coming out correct
//TODO: Calculate how to setup pools so that rewards align with the requirement
// TODO: What is the LP token address?
contract PoolLPTokenWrapper {
    using SafeMath for uint256;
    IUniswapV2Pair public token;

    constructor(IUniswapV2Pair _lpToken) {
        token = IUniswapV2Pair(_lpToken);
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

contract MemeXStaking is PoolLPTokenWrapper, Ownable, Pausable {
    using SafeMath for uint256;

    struct Pool {
        uint256 periodStart;
        uint256 maxStake;
        uint256 rewardRate;
        IRewards rewardToken;
        uint256 controllerShare;
        address artist;
        uint256 boostAmount; //Boost amount in precision of 100. ie. 125 will boost reward rate by 1.25
        bool isBoosted; 
        bool hasPinaRewards;
        mapping(address => uint256) lastUpdateTimePoints;
        mapping(address => uint256) lastUpdateTimePinas;
        mapping(address => uint256) pinasToWithdraw;
        mapping(address => uint256) points;
    }

    address public controller;
    address public rescuer;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(uint256 => Pool) public pools;
    mapping (uint256 => uint256) public pinaRewardsStartTime;

    event UpdatedArtist(uint256 poolId, address artist);
    event PoolAdded(
        uint256 poolId,
        address artist,
        uint256 periodStart,
        uint256 rewardRate,
        IRewards rewardToken,
        uint256 maxStake,
        uint256 boostAmount,
        bool isBoosted
    );

    event Staked(address indexed user, uint256 poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 poolId, uint256 amount);
    event WithdrawnPinas(address indexed user, uint256 poolId, uint256 amount);
    event TicketBought(address indexed user, uint256 poolId, uint256 amount);

    event Transferred(
        address indexed user,
        uint256 fromPoolId,
        uint256 toPoolId,
        uint256 amount
    );

//TODO: Think how to manage pina rewards. Test this
    modifier updateReward(address account, uint256 id) {
        if (account != address(0)) {
            if (pools[id].hasPinaRewards){
                // This should execute once when the has pina rewards is activated but the rewards for the account have not been updated.
                // Write a test for this.
                if (pinaRewardsStartTime[id] > pools[id].lastUpdateTimePinas[account]){
                    pools[id].lastUpdateTimePinas[account] =  pinaRewardsStartTime[id];
                }
                pools[id].pinasToWithdraw[account] = earnedPinas(account, id);
                
            }
            pools[id].points[account] =  earnedPoints(account, id);
            pools[id].lastUpdateTimePinas[account] = block.timestamp;
            pools[id].lastUpdateTimePoints[account] = block.timestamp;
        }
        _;
    }


    modifier poolExists(uint256 id) {
        require(pools[id].rewardRate > 0, "pool does not exists");
        _;
    }

    constructor(address _controller, IUniswapV2Pair _tokenAddress)
        PoolLPTokenWrapper(_tokenAddress)
    {
        controller = _controller;
    }

//TODO: Is it related to accounts or pools??
    function boost(uint256 pool) public view returns (uint256){
        Pool storage p = pools[pool];

        if(p.isBoosted){
            return p.boostAmount;
        }
        return 100;
    }


    function setIsBoost(uint256 pool, bool _isBoost) public onlyOwner {
        Pool storage p = pools[pool];

        p.isBoosted = _isBoost;
    }


     function activatePinaRewards(uint256 pool) public onlyOwner {
        Pool storage p = pools[pool];
        p.hasPinaRewards = true;
        pinaRewardsStartTime[pool] = block.timestamp;
    }

    function withdrawPinas(address account, uint256 pool)
        public
        updateReward(msg.sender, pool)
    {
        require(
            pools[pool].pinasToWithdraw[account] > 0,
            "no pinas to withdraw"
        );
        require(
            pools[pool].hasPinaRewards,
            "No pina rewards for the pool"
        );
        uint256 pinas = pools[pool].pinasToWithdraw[account];
        pools[pool].pinasToWithdraw[account] = 0;
        pools[pool].rewardToken.mintPinas(account, pinas);
        emit WithdrawnPinas(account, pool, pinas);
    }

    

///TODO: Ask SIlver do we need to decrease points on buying
    function buyTicket(address account, uint256 pool, uint256 costOfTicket)
        public 
        updateReward(msg.sender, pool)
    {
        require(
            pools[pool].points[account] >= costOfTicket,
            "LPSTakingWithBoost.buyTicket: not enough points to buy tickets"
        );

        uint256 points = pools[pool].points[account];
        pools[pool].points[account] -= costOfTicket;
        emit TicketBought(account, pool, points);
    }

    function earnedPinas(address account, uint256 pool)
        public
        view
        returns (uint256)
    {
        Pool storage p = pools[pool];
        uint256 blockTime = block.timestamp;
        uint256 rewardRate = p.rewardRate.mul(boost(pool)).div(100);
         
        return
            balanceOf(account, pool)
            .div(1e18) // divide by the decimals of the token used
                .mul(blockTime.sub(p.lastUpdateTimePinas[account]).mul(rewardRate))
                .add(p.pinasToWithdraw[account]);
                
    }

    function earnedPoints(address account, uint256 pool) public view returns (uint256) {
		Pool storage p = pools[pool];
		uint256 blockTime = block.timestamp;
		uint256 rewardRate = p.rewardRate.mul(boost(pool)).div(100);

		return
			balanceOf(account, pool).mul(blockTime.sub(p.lastUpdateTimePoints[account]).mul(rewardRate)).div(1e18).add(
				p.points[account]
			);
	}

    // override PoolLPTokenWrapper's stake() function
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

    // override PoolLPTokenWrapper's \draw() function
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

    // override PoolLPTokenWrapper's transfer() function
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

    ///@dev Sets artist of a pool
    function setArtist(uint256 pool, address artist) public onlyOwner {
        uint256 amount = pendingWithdrawals[artist];
        pendingWithdrawals[artist] = 0;
        pendingWithdrawals[artist] = pendingWithdrawals[artist].add(amount);
        pools[pool].artist = artist;

        emit UpdatedArtist(pool, artist);
    }

    ///@dev Sets controller of the staker
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
        address artist,
        uint256 boostAmount, //Boost amount in precision of 100. ie. 125 will boost reward rate by 1.25
        bool isBoosted
    ) public onlyOwner {
        require(pools[id].rewardRate == 0, "pool exists");

        Pool storage p = pools[id];

        p.periodStart = periodStart;
        p.maxStake = maxStake;
        p.rewardRate = rewardRate;
        p.rewardToken = rewardToken;
        p.controllerShare = controllerShare;
        p.artist = artist;
        p.boostAmount = boostAmount;
        p.isBoosted = isBoosted;
        emit PoolAdded(
            id,
            artist,
            periodStart,
            rewardRate,
            rewardToken,
            maxStake,
            boostAmount,
            isBoosted
        );
    }

    function withdrawFee() public {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}
