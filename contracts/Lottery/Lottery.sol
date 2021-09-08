pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/IMemeXNFT.sol";

/// SSS TODO: Add more events maybe??
contract Lottery is Ownable {
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private lotteryCounter;

    bytes32 internal requestId_;

    uint8 liquidityProviderMultiplier;

    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;
    IRewards public stakeContract;
    IRewards public lpStakeContract;

    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    //lotteryid => prizeIds[]
    mapping(uint256 => uint256[]) internal prizes;

    //lotteryid => address => participantInfo
    mapping(uint256 => mapping(address => ParticipantInfo))
        internal participants;

    //lotteryId => number => address (allows multiple numbers per participant)
    mapping(uint256 => mapping(uint256 => address)) numbersToParticipant;

    enum Status {
        Planned, // The lottery is only planned, cant buy tickets yet
        Canceled, // A lottery that got canceled
        Open, // Entries are open
        Closed, // Entries are closed. Must be closed to draw numbers
        Completed // The lottery has been completed and the numbers drawn
    }

    struct ParticipantInfo {
        address participantAddress;
        bool isLiquidityProvider;
        bool isBooster;
        uint256 prizeId;
        bool prizeClaimed;
    }

    struct LotteryCosts {
        uint256 ticketCost;
        uint256 boostCost;
        uint256 mintCost;
    }

    // Information about lotteries
    struct LotteryInfo {
        uint256 lotteryID; // ID for lotto
        Status status; // Status for lotto
        LotteryCosts costs; // Struct with all lottery costs
        uint256 startingTime; // Timestamp to start the lottery
        uint256 closingTime; // Timestamp for end of entries
        IMemeXNFT nftContract; // reference to the NFT Contract
        Counters.Counter numbers; // luck numbers assigned to participants (those will define winners)
        Counters.Counter participantsCount; // number of participants
        uint256 stakePoolId; // id of the stake pool in use
        // optional prize that every participant would win if they don't get better prizes
        // IMPORTANT: WE SHOULD NOT USE A PRIZE ID = 0 OR IT WOULD BE USED EVEN WHEN WE DON'T SET THIS FIELD
        uint256 defaultPrizeId;
    }

    event ResponseReceived(bytes32 _requestId);
    event PrizesChanged(uint256 _lotteryId, uint256 numberOfPrizes);
    event LotteryStatusChanged(uint256 _lotteryId, Status _status);
    event RequestNumbers(uint256 lotteryId, bytes32 requestId);
    event NewParticipant(
        uint256 lotteryId,
        address participantAddress,
        uint16 amountOfNumbers
    );
    event TicketCostChanged(
        address operator,
        uint256 lotteryId,
        uint256 priceOfTicket
    );
    event NumberAssignedToParticipant(
        uint256 lotteryId,
        uint256 number,
        address participantAddress
    );

    constructor(address _stakeContract, address _lpStakeContract) public {
        stakeContract = IRewards(_stakeContract);
        lpStakeContract = IRewards(_lpStakeContract);
    }

    function setTicketCost(uint256 _price, uint256 _lotteryId)
        public
        onlyOwner
    {
        lotteryHistory[_lotteryId].costs.ticketCost = _price;
        emit TicketCostChanged(msg.sender, _lotteryId, _price);
    }

    function setLiquidityProviderMultiplier(uint8 _multiplier)
        public
        onlyOwner
    {
        liquidityProviderMultiplier = _multiplier;
    }

    // function _isLiquidityProvider(address _participant)
    //     internal
    //     returns (bool)
    // {
    //     return pinaRewards.isLiquidityProvider(_participant);
    // }

    function _burnPinas(
        address _user,
        LotteryInfo memory lottery,
        IRewards rewardsToken
    ) internal {
        uint256 costPerTicket = lottery.costs.ticketCost;
        require(
            rewardsToken.balanceOf(_user) >= costPerTicket,
            "Not enough PINA tokens to enter the lottery"
        );
        rewardsToken.burnPinas(_user, costPerTicket);
    }

    function _checkEnoughPina(address _user, LotteryInfo memory lottery)
        internal
    {
        require(
            stakeContract.earned(_user, lottery.stakePoolId) >=
                lottery.costs.ticketCost,
            "Not enough PINA points to enter the lottery"
        );
    }

    function setRandomGenerator(address _IRandomNumberGenerator)
        external
        onlyOwner
    {
        require(
            _IRandomNumberGenerator != address(0),
            "Contracts cannot be 0 address"
        );
        randomGenerator = IRandomNumberGenerator(_IRandomNumberGenerator);
    }

    function getLotteryInfo(uint256 _lotteryId)
        public
        view
        returns (LotteryInfo memory)
    {
        return (lotteryHistory[_lotteryId]);
    }

    function getNumberOfParticipants(uint256 _lotteryId)
        public
        view
        returns (uint256)
    {
        return lotteryHistory[_lotteryId].participantsCount.current();
    }

    modifier onlyRandomGenerator() {
        require(msg.sender == address(randomGenerator), "Only RNG address");
        _;
    }

    function addPrizes(uint256 _lotteryId, uint256[] calldata _prizeIds)
        public
        onlyOwner
    {
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        require(_prizeIds.length > 0, "No prize ids");
        for (uint256 i = 0; i < _prizeIds.length; i++) {
            prizes[_lotteryId].push(_prizeIds[i]);
        }
        emit PrizesChanged(_lotteryId, prizes[_lotteryId].length);
    }

    function createNewLottery(
        uint256 _costPerTicket,
        uint256 _startingTime,
        uint256 _closingTime,
        IMemeXNFT _nftContract,
        uint256[] calldata _prizeIds,
        uint256 _boostCost,
        uint256 _mintCost,
        uint256 _stakePoolId,
        string calldata _baseMetadataURI,
        uint256 _defaultPrizeId
    ) public onlyOwner returns (uint256 lotteryId) {
        // DISABLED FOR TESTS require(_costPerTicket != 0, "Ticket cost cannot be 0");
        require(
            _startingTime != 0 && _startingTime < _closingTime,
            "Timestamps for lottery invalid"
        );
        // Incrementing lottery ID
        lotteryCounter.increment();
        lotteryId = lotteryCounter.current();
        Status lotteryStatus;
        if (_startingTime >= getCurrentTime()) {
            lotteryStatus = Status.Open;
        } else {
            lotteryStatus = Status.Planned;
        }
        LotteryCosts memory costs = LotteryCosts(
            _costPerTicket,
            _boostCost,
            _mintCost
        );
        // Saving data in struct
        LotteryInfo memory newLottery = LotteryInfo(
            lotteryId,
            lotteryStatus,
            costs,
            _startingTime,
            _closingTime,
            _nftContract,
            Counters.Counter(0),
            Counters.Counter(0),
            _stakePoolId,
            _defaultPrizeId
        );
        IMemeXNFT nftContract = _nftContract;
        nftContract.setBaseMetadataURI(_baseMetadataURI);
        prizes[lotteryId] = _prizeIds;
        emit PrizesChanged(lotteryId, _prizeIds.length);
        lotteryHistory[lotteryId] = newLottery;
    }

    function getCurrentLotteryId() public view returns (uint256) {
        return (lotteryCounter.current());
    }

    function getCurrentTime() public view returns (uint256) {
        return block.timestamp;
    }

    function drawWinningNumbers(uint256 _lotteryId) external onlyOwner {
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(prizes[_lotteryId].length != 0, "No prizes for this lottery");
        // DISABLED FOR TESTS require(lottery.closingTime < block.timestamp);
        if (lottery.status == Status.Open) {
            lottery.status = Status.Closed;
        }
        require(
            lottery.status == Status.Closed,
            "Must be closed prior to draw"
        );
        requestId_ = randomGenerator.getRandomNumber(_lotteryId);
        // Emits that random number has been requested
        emit RequestNumbers(_lotteryId, requestId_);
    }

    function numbersDrawn(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) external onlyRandomGenerator {
        emit ResponseReceived(_requestId);
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.status == Status.Closed, "Lottery must be closed");

        uint16 numberOfPrizes_ = uint16(prizes[_lotteryId].length);
        uint256 totalParticipants_ = lottery.participantsCount.current();

        // if there are less participants than prizes, reduce the number of prizes
        if (totalParticipants_ < numberOfPrizes_) {
            numberOfPrizes_ = uint16(totalParticipants_);
        }
        // Loops through each prize
        for (uint16 i = 0; i < numberOfPrizes_; i++) {
            // Encodes the random number with its position in loop
            bytes32 hashOfRandom = keccak256(
                abi.encodePacked(_randomNumber, i)
            );
            // Casts random number hash into uint256
            uint256 numberRepresentation = uint256(hashOfRandom);
            // Sets the winning number position to a uint16 of random hash number
            uint16 winningNumber = uint16(
                numberRepresentation.mod(totalParticipants_)
            );
            // defines the winner
            bool winnerFound = false;
            do {
                address winnerAddress = numbersToParticipant[_lotteryId][
                    winningNumber
                ];
                ParticipantInfo storage participant = participants[_lotteryId][
                    winnerAddress
                ];
                if (
                    participant.prizeId != 0 &&
                    participant.prizeId != lottery.defaultPrizeId
                ) {
                    // If address is already a winner pick the next number until a new winner is found
                    winningNumber++;
                } else {
                    participant.prizeId = prizes[_lotteryId][i];
                    winnerFound = true;
                }
            } while (winnerFound == false);
        }
        lottery.status = Status.Completed;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    function cancelLottery(uint256 _lotteryId) public onlyOwner {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Canceled;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    function buyTicket(uint256 _lotteryId) public {
        require(
            participants[_lotteryId][msg.sender].participantAddress ==
                address(0),
            "Already bought ticket to this lottery"
        );

        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        if (
            lottery.status == Status.Planned &&
            lottery.startingTime < block.timestamp
        ) {
            lottery.status = Status.Open;
            emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        if (
            lottery.status == Status.Open &&
            lottery.closingTime < block.timestamp
        ) {
            lottery.status = Status.Closed;
            emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        require(lottery.status == Status.Open, "Lottery not open");

        IRewards rewardsToken = stakeContract.getPoolRewardToken(
            lottery.stakePoolId
        );
        // if the pool in use is rewarding ERC-20 tokens we burn the ticket cost
        if (address(rewardsToken) != address(0)) {
            _burnPinas(msg.sender, lottery, rewardsToken);
        } else {
            // if the pool is not using tokens we just handle the reward as points
            _checkEnoughPina(msg.sender, lottery);
        }

        ParticipantInfo memory newParticipant = ParticipantInfo(
            msg.sender,
            false, //_isLiquidityProvider(msg.sender),
            false,
            lottery.defaultPrizeId, // all participants will start with default prize, if any
            false
        );
        lottery.participantsCount.increment();
        participants[_lotteryId][msg.sender] = newParticipant;
        if (newParticipant.isLiquidityProvider) {
            for (uint8 i = 0; i < liquidityProviderMultiplier; i++) {
                assignNewNumberToParticipant(_lotteryId, msg.sender);
            }
        } else {
            assignNewNumberToParticipant(_lotteryId, msg.sender);
        }
    }

    function assignNewNumberToParticipant(
        uint256 _lotteryId,
        address _participantAddress
    ) private {
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        ParticipantInfo storage participant = participants[_lotteryId][
            _participantAddress
        ];
        require(
            participant.participantAddress != address(0),
            "Participant not found"
        );
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        numbersToParticipant[_lotteryId][
            lottery.numbers.current()
        ] = _participantAddress;
        emit NumberAssignedToParticipant(
            _lotteryId,
            lottery.numbers.current(),
            _participantAddress
        );
        lottery.numbers.increment();
    }

    function isBooster(uint256 _lotteryId, address _participantAddress)
        public
        view
        returns (bool)
    {
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        ParticipantInfo memory participant = participants[_lotteryId][
            _participantAddress
        ];
        return participant.isBooster;
    }

    // What should happen if participant is boosted?
    function boostParticipant(uint256 _lotteryId, address _participantAddress)
        public
        payable
    {
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        ParticipantInfo storage participant = participants[_lotteryId][
            _participantAddress
        ];
        require(
            participant.participantAddress != address(0),
            "Participant not found"
        );
        require(
            participant.isBooster == false,
            "Participant already a booster"
        );
        // check if the transaction contains the boost cost
        require(
            msg.value >= lotteryHistory[_lotteryId].costs.boostCost,
            "Not enough tokens to boost"
        );

        participant.isBooster = true;
        assignNewNumberToParticipant(_lotteryId, _participantAddress);
    }

    function isAddressWinner(uint256 _lotteryId, address _address)
        public
        view
        returns (
            bool,
            uint256,
            bool
        )
    {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        require(lottery.status == Status.Completed, "Lottery not completed");
        ParticipantInfo memory participant = participants[_lotteryId][_address];
        return (
            participant.prizeId != 0,
            participant.prizeId,
            participant.prizeClaimed
        );
    }

    function isCallerWinner(uint256 _lotteryId)
        public
        view
        returns (
            bool,
            uint256,
            bool
        )
    {
        return isAddressWinner(_lotteryId, msg.sender);
    }

    function getDefaultPrizeId(uint256 _lotteryId)
        public
        view
        returns (uint256)
    {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        return lottery.defaultPrizeId;
    }

    function redeemNFT(uint256 _lotteryId) public {
        require(
            lotteryHistory[_lotteryId].status == Status.Completed,
            "Status Not Completed"
        );
        ParticipantInfo storage participant = participants[_lotteryId][
            msg.sender
        ];
        require(!participant.prizeClaimed, "Participant already claimed prize");
        require(participant.prizeId != 0, "Participant is not a winner");
        participant.prizeClaimed = true;
        IMemeXNFT nftContract = lotteryHistory[_lotteryId].nftContract;
        ///SSS TODO: Add Create instead of mint
        nftContract.mint(msg.sender, participant.prizeId, 1, "", _lotteryId);
    }

    function withdraw(address payable _to, uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance);
        _to.transfer(_amount);
    }
}
