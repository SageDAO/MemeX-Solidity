//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/INFT.sol";
import "../../interfaces/ILottery.sol";
import "../../interfaces/IWhitelist.sol";
import "../../interfaces/ISageStorage.sol";

contract Lottery is
    Initializable,
    AccessControlUpgradeable,
    ILottery,
    UUPSUpgradeable,
    PausableUpgradeable
{
    ISageStorage private sageStorage;

    address private signerAddress;

    IERC20 public token;

    // Address of the randomness generator
    IRandomNumberGenerator private randomGenerator;
    IRewards public rewardsContract;

    uint256[] public lotteries;

    //lotteryId => LotteryInfo
    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    // lotteryId => whitelist contract address
    mapping(uint256 => address) public whitelists;

    // loteryId => merkle tree root
    mapping(uint256 => bytes32) public prizeMerkleRoots;

    // lotteryId => tokenId => claimed state
    mapping(uint256 => mapping(uint256 => bool)) public claimedPrizes;

    //lotteryid => address => participantInfo
    mapping(uint256 => mapping(address => ParticipantInfo)) public participants;

    // lotteryid => address => available refund
    mapping(uint256 => mapping(address => uint256)) public refunds;

    //loteryId => randomNumber received from RNG
    mapping(uint256 => uint256) public randomSeeds;

    //lotteryId => address array
    mapping(uint256 => address[]) public lotteryTickets;

    // Information about lotteries
    struct LotteryInfo {
        uint32 startTime; // Timestamp where users can start buying tickets
        uint32 closeTime; // Timestamp where ticket sales end
        uint32 participantsCount; // number of participants
        uint32 maxTickets; // max number of tickets for the lottery
        uint32 maxTicketsPerUser; // max number of tickets per user
        uint32 numberOfTicketsSold; // number of tickets sold
        Status status; // Status for lotto
        INFT nftContract; // reference to the NFT Contract
        uint128 firstPrizeId;
        uint128 lastPrizeId;
        uint256 lotteryID; // ID for lotto
        uint256 ticketCostPoints; // Cost per ticket in points for member users (who earned points)
        uint256 ticketCostTokens; // Cost per ticket in ETH for member users (who earned points)
    }

    struct ParticipantInfo {
        uint16 totalTicketsBought;
        bool claimedPrize;
    }

    enum Status {
        Created, // The lottery has been created
        Cancelled, // A lottery that got canceled
        Closed, // Entries are closed. Must be closed to draw numbers
        Completed // The lottery has been completed and the numbers drawn
    }

    event LotteryStatusChanged(
        uint256 indexed lotteryId,
        Status indexed status
    );

    event TicketCostChanged(
        address operator,
        uint256 lotteryId,
        uint256 priceOfTicket
    );
    event TicketSold(
        uint256 indexed lotteryId,
        uint256 ticketNumber,
        address indexed participantAddress
    );
    event PrizeClaimed(
        uint256 indexed lotteryId,
        address indexed participantAddress,
        uint256 indexed prizeId
    );

    event Refunded(
        uint256 indexed lotteryId,
        address indexed participantAddress,
        uint256 amount
    );

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(sageStorage.hasRole(0x00, msg.sender), "Admin calls only");
        _;
    }

    modifier validLottery(uint32 startTime, uint32 closeTime) {
        require(startTime > 0, "Invalid start time");
        require(closeTime > startTime, "Close time must be after start time");
        _;
    }

    /**
     * @notice Throws an error if the lottery has a whitelist and the msg.sender is not whitelisted.
     */
    modifier isWhitelisted(uint256 _lotteryId) {
        // checks if the lottery has a whitelist
        if (whitelists[_lotteryId] != address(0)) {
            // if lottery has a whitelist, requires msg.sender to be whitelisted, else throws
            require(
                IWhitelist(whitelists[_lotteryId]).isWhitelisted(
                    msg.sender,
                    _lotteryId
                ),
                "Not whitelisted"
            );
        }
        _;
    }

    /**
     * @dev Constructor for an upgradable contract
     */
    function initialize(
        address _rewardsContract,
        address _admin,
        address _token,
        address _sageStorage
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        token = IERC20(_token);
        signerAddress = _admin;
        rewardsContract = IRewards(_rewardsContract);
        sageStorage = ISageStorage(_sageStorage);
    }

    function setPrizeMerkleRoot(uint256 _lotteryId, bytes32 _root)
        public
        onlyAdmin
    {
        prizeMerkleRoots[_lotteryId] = _root;
    }

    function setToken(address _token) public onlyAdmin {
        token = IERC20(_token);
    }

    function getWhitelist(uint256 _lotteryId) public view returns (address) {
        return whitelists[_lotteryId];
    }

    function setWhitelist(uint256 _lotteryId, address _whitelist)
        public
        onlyAdmin
    {
        whitelists[_lotteryId] = _whitelist;
    }

    function setSignerAddress(address _signer) public onlyAdmin {
        signerAddress = _signer;
    }

    function setMaxTickets(uint256 _lotteryId, uint32 _maxTickets)
        public
        onlyAdmin
    {
        lotteryHistory[_lotteryId].maxTickets = _maxTickets;
    }

    function setMaxTicketsPerUser(uint256 _lotteryId, uint32 _maxTicketsPerUser)
        public
        onlyAdmin
    {
        lotteryHistory[_lotteryId].maxTicketsPerUser = _maxTicketsPerUser;
    }

    function _burnUserPoints(address _user, uint256 _amount)
        internal
        returns (uint256)
    {
        return rewardsContract.burnUserPoints(_user, _amount);
    }

    function setRewardsContract(address _rewardsContract) public onlyAdmin {
        rewardsContract = IRewards(_rewardsContract);
    }

    function changeCloseTime(uint256 _lotteryId, uint32 _time)
        public
        onlyAdmin
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.startTime > 0, "Lottery id not found");
        require(
            _time > lottery.startTime,
            "Close time must be after start time"
        );
        lottery.closeTime = _time;
    }

    function setRandomGenerator(address _IRandomNumberGenerator)
        external
        onlyAdmin
    {
        require(
            _IRandomNumberGenerator != address(0),
            "Contracts cannot be 0 address"
        );
        randomGenerator = IRandomNumberGenerator(_IRandomNumberGenerator);
    }

    function prizeClaimed(uint256 _lotteryId, uint256 _tokenId)
        public
        view
        returns (bool)
    {
        return claimedPrizes[_lotteryId][_tokenId];
    }

    /**
     * @notice Get the number of tickets sold for a lottery
     * @param _lotteryId The lottery ID
     * @return Amount tickets for a lottery
     */
    function getLotteryTicketCount(uint256 _lotteryId)
        public
        view
        returns (uint256)
    {
        return lotteryHistory[_lotteryId].numberOfTicketsSold;
    }

    function getLotteryCount() public view returns (uint256) {
        return lotteries.length;
    }

    /**
     * @notice Query lottery info
     * @param _lotteryId The lottery ID
     * @return Lottery info
     */
    function getLotteryInfo(uint256 _lotteryId)
        public
        view
        returns (LotteryInfo memory)
    {
        return (lotteryHistory[_lotteryId]);
    }

    modifier onlyRandomGenerator() {
        require(msg.sender == address(randomGenerator), "Only RNG address");
        _;
    }

    // Builds a prefixed hash to mimic the behavior of eth_sign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function buyTicketsWithSignedMessage(
        uint256 _points,
        uint256 _lotteryId,
        uint256 _numberOfTicketsToBuy,
        bytes calldata _sig
    ) public {
        address _user = msg.sender;
        bytes32 message = prefixed(keccak256(abi.encode(_user, _points)));
        require(
            ECDSAUpgradeable.recover(message, _sig) == signerAddress,
            "Invalid signature"
        );

        if (rewardsContract.totalPointsEarned(_user) < _points) {
            rewardsContract.claimPoints(_user, _points);
        }

        buyTickets(_lotteryId, _numberOfTicketsToBuy);
    }

    function updateLottery(
        uint256 lotteryId,
        uint256 _ticketCostPoints,
        uint256 _ticketCostTokens,
        uint32 _startTime,
        uint32 _closeTime,
        INFT _nftContract,
        uint16 _maxTickets,
        Status _status,
        uint128 _firstPrizeId,
        uint128 _lastPrizeId
    ) public onlyAdmin validLottery(_startTime, _closeTime) {
        LotteryInfo storage lottery = lotteryHistory[lotteryId];
        lottery.startTime = _startTime;
        lottery.closeTime = _closeTime;
        lottery.ticketCostPoints = _ticketCostPoints;
        lottery.ticketCostTokens = _ticketCostTokens;
        lottery.nftContract = _nftContract;
        lottery.maxTickets = _maxTickets;
        lottery.status = _status;
        lottery.firstPrizeId = _firstPrizeId;
        lottery.lastPrizeId = _lastPrizeId;
        emit LotteryStatusChanged(lotteryId, _status);
    }

    /**
     * @notice Creates a new lottery.
     * @param _lotteryInfo lotteryInfo struct
     */
    function createLottery(LotteryInfo calldata _lotteryInfo)
        public
        onlyAdmin
        validLottery(_lotteryInfo.startTime, _lotteryInfo.closeTime)
    {
        require(_lotteryInfo.firstPrizeId > 0, "Invalid prizes");
        require(_lotteryInfo.numberOfTicketsSold == 0, "Invalid value");
        require(
            lotteryHistory[_lotteryInfo.lotteryID].firstPrizeId == 0,
            "Lottery already exists"
        );
        lotteries.push(_lotteryInfo.lotteryID);
        lotteryHistory[_lotteryInfo.lotteryID] = _lotteryInfo;
        emit LotteryStatusChanged(_lotteryInfo.lotteryID, Status.Created);
    }

    function createLotteryBatch(LotteryInfo[] calldata _lotteries)
        public
        onlyAdmin
    {
        uint256 length = _lotteries.length;
        for (uint256 i = 0; i < length; ++i) {
            createLottery(_lotteries[i]);
        }
    }

    /**
     * @notice Called by the team to request a random number to a particular lottery.
     * @param _lotteryId ID of the lottery the random number is for
     */
    function requestRandomNumber(uint256 _lotteryId) external onlyAdmin {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.startTime > 0, "Invalid lottery id");
        require(lottery.closeTime < block.timestamp, "Lottery is not closed");
        if (lottery.status == Status.Created) {
            lottery.status = Status.Closed;
            emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        // should fail if the lottery is completed (already called drawWinningNumbers and received a response)
        require(lottery.status == Status.Closed, "Lottery must be closed!");
        randomGenerator.requestRandomWords(_lotteryId);
    }

    /**
     * @notice Callback function called by the RNG contract after receiving the chainlink response.
     * Will use the received random number to assign prizes to random participants.
     * @param _lotteryId ID of the lottery the random number is for
     * @param _randomNumber Random number provided by the VRF chainlink oracle
     */
    function receiveRandomNumber(uint256 _lotteryId, uint256 _randomNumber)
        external
        onlyRandomGenerator
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.status == Status.Closed, "Lottery must be closed");

        lottery.status = Status.Completed;
        randomSeeds[_lotteryId] = _randomNumber;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    /**
     * @notice Returns an array of tickets sold for a lottery within a range.
     * @param _lotteryId The lottery ID
     * @param _from The start index of the array
     * @param _to The end index of the array
     * @return Array with tickets for a lottery inside the requested range
     */
    function getLotteryTickets(
        uint256 _lotteryId,
        uint256 _from,
        uint256 _to
    ) public view returns (address[] memory) {
        address[] memory result = new address[](_to - _from + 1);
        for (uint256 i = _from; i <= _to; i++) {
            result[i] = lotteryTickets[_lotteryId][i];
        }
        return result;
    }

    /**
     * @notice Get the number of participants in a lottery.
     * @param _lotteryId The lottery ID
     * @return Amount of different addresses that have entered the lottery
     */
    function getParticipantsCount(uint256 _lotteryId)
        public
        view
        returns (uint32)
    {
        return lotteryHistory[_lotteryId].participantsCount;
    }

    /**
     * @notice Change the lottery state to canceled.
     * @param _lotteryId ID of the lottery to canccel
     */
    function cancelLottery(uint256 _lotteryId) public onlyAdmin {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.participantsCount == 0, "Lottery already started");
        lottery.status = Status.Cancelled;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    /**
     * @notice Function called by users to buy lottery tickets using points or ETH
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param _numberOfTicketsToBuy Number of tickets to buy
     */
    function buyTickets(uint256 _lotteryId, uint256 _numberOfTicketsToBuy)
        public
        whenNotPaused
        isWhitelisted(_lotteryId)
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        uint256 totalCostInTokens;
        uint256 totalCostInPoints;
        uint256 costPerTicketTokens;

        if (lottery.maxTickets != 0) {
            require(
                lottery.numberOfTicketsSold + _numberOfTicketsToBuy <=
                    lottery.maxTickets,
                "Tickets sold out"
            );
        }

        ParticipantInfo storage participantInfo = participants[_lotteryId][
            msg.sender
        ];
        uint256 numTicketsBought = participantInfo.totalTicketsBought;
        if (lottery.maxTicketsPerUser > 0) {
            require(
                numTicketsBought + _numberOfTicketsToBuy <=
                    lottery.maxTicketsPerUser,
                "Can't buy this amount of tickets"
            );
        }
        require(
            lottery.startTime <= block.timestamp &&
                lottery.closeTime > block.timestamp &&
                lottery.status != Status.Cancelled,
            "Lottery is not open"
        );

        totalCostInPoints = _numberOfTicketsToBuy * lottery.ticketCostPoints;

        if (totalCostInPoints > 0) {
            _burnUserPoints(msg.sender, totalCostInPoints);
        }

        costPerTicketTokens = lottery.ticketCostTokens;

        lottery.numberOfTicketsSold += uint32(_numberOfTicketsToBuy);
        if (costPerTicketTokens > 0) {
            totalCostInTokens = _numberOfTicketsToBuy * costPerTicketTokens;
            token.transferFrom(msg.sender, address(this), totalCostInTokens);
            refunds[_lotteryId][msg.sender] += totalCostInTokens;
        }

        if (numTicketsBought == 0) {
            ++lottery.participantsCount;
            participants[_lotteryId][msg.sender] = participantInfo;
        }
        participantInfo.totalTicketsBought += uint16(_numberOfTicketsToBuy);
        address[] storage tickets = lotteryTickets[_lotteryId];
        for (uint256 i; i < _numberOfTicketsToBuy; ++i) {
            tickets.push(msg.sender);
            emit TicketSold(_lotteryId, tickets.length, msg.sender);
        }
    }

    function claimPrize(
        uint256 _lotteryId,
        address _winner,
        uint256 _ticketNumber,
        string calldata _uri,
        bytes32[] calldata _proof
    ) public whenNotPaused {
        require(
            !claimedPrizes[_lotteryId][_ticketNumber],
            "Participant already claimed prize"
        );

        require(
            _verify(
                _leaf(_lotteryId, _winner, _ticketNumber, _uri),
                prizeMerkleRoots[_lotteryId],
                _proof
            ),
            "Invalid merkle proof"
        );

        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        uint256 ticketCostTokens = lottery.ticketCostTokens;
        if (ticketCostTokens > 0) {
            // After claiming a prize the refundable balance should decrease.
            // Reverts if the user doesn't have enough refundable balance.
            refunds[_lotteryId][msg.sender] -= ticketCostTokens;
            token.transfer(address(lottery.nftContract), ticketCostTokens);
        }

        participants[_lotteryId][_winner].claimedPrize = true;
        INFT nftContract = lotteryHistory[_lotteryId].nftContract;

        claimedPrizes[_lotteryId][_ticketNumber] = true;
        nftContract.safeMint(_winner, _uri);
        emit PrizeClaimed(_lotteryId, _winner, _ticketNumber);
    }

    function _leaf(
        uint256 _lotteryId,
        address _winner,
        uint256 _prizeId,
        string memory _uri
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(_lotteryId, _winner, _prizeId, _uri));
    }

    function _verify(
        bytes32 _leafHash,
        bytes32 _root,
        bytes32[] memory _proof
    ) internal pure returns (bool) {
        return MerkleProofUpgradeable.verify(_proof, _root, _leafHash);
    }

    function getTicketCountPerUser(uint256 _lotteryId, address _user)
        public
        view
        returns (uint256)
    {
        ParticipantInfo storage participantInfo = participants[_lotteryId][
            _user
        ];
        return participantInfo.totalTicketsBought;
    }

    /**
     * @notice Function called to withdraw funds (tokens) from the contract.
     * @param _to Recipient of the funds
     * @param _amount Amount to withdraw
     */
    function withdraw(address _to, uint256 _amount) external onlyAdmin {
        token.transfer(_to, _amount);
    }

    function refund(
        address _assetOwner,
        uint256 _lotteryId,
        uint256 _amount
    ) public whenNotPaused {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(_amount > 0, "Can't refund 0");
        require(lottery.status != Status.Created, "Invalid lottery state");
        require(
            refunds[_lotteryId][_assetOwner] >= _amount,
            "Can't refund the amount requested"
        );
        refunds[_lotteryId][_assetOwner] -= _amount;
        token.transfer(_assetOwner, _amount);
        emit Refunded(_lotteryId, _assetOwner, _amount);
    }

    function refundBatch(
        address[] memory _owners,
        uint256 _lotteryId,
        uint256[] memory _amounts
    ) external {
        uint256 arrayLength = _owners.length;
        require(arrayLength == _amounts.length, "Wrong arguments");
        for (uint256 i = 0; i < arrayLength; ++i) {
            refund(_owners[i], _lotteryId, _amounts[i]);
        }
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyAdmin
    {}
}
