pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";

/// SSS: Things to think about:
// Winning numbers should be generated based on reward points;

// From last meeting I think we should have only the function to buy one ticket

// i didn't understand the reason behind multiple staking pools
// from what i understood the user could stake, get a few points and continue staking to participate on a next lottery (staking could remain the same for different lotteries)

contract Lottery is Ownable {
    using SafeMath for uint256;

    // Address of the PINA token
    bytes32 internal requestId_;

    uint256 public poolId;
    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;
    IRewards public pinaRewards;

    uint256 private lotteryCounter;
    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    //lotteryid => participants
    mapping(uint256 => address[]) internal participants;

    //lotteryId => participantId => participant address
    mapping(uint256 => mapping(uint256 => address)) participant;

    mapping(uint256 => mapping(uint256 => bool)) winningParticipants;

    //lotteryId => participant address => participantId
    mapping(uint256 => mapping(address => uint256)) participantToId;
    enum Status {
        Planned, // The lottery is only planned, cant buy tickets yet
        Canceled, // A lottery that got canceled
        Open, // Entries are open
        Closed, // Entries are closed. Must be closed to draw numbers
        Completed // The lottery has been completed and the numbers drawn
    }

    // Information about lotteries
    struct LotteryInfo {
        uint256 lotteryID; // ID for lotto
        Status status; // Status for lotto
        uint16 lotSize; // number of NFTs on this lot
        uint256 costPerTicket; // Cost per ticket in $PINA
        uint256 startingTime; // Timestamp to start the lottery
        uint256 closingTime; // Timestamp for end of entries
        uint16[] winningNumbers; // The winning numbers
    }

    event RequestNumbers(uint256 lotteryId, bytes32 requestId);
    event TicketCostChanged(
        address operator,
        uint256 lotteryId,
        uint256 priceOfTicket
    );

    //-------------------------------------------------------------------------
    // CONSTRUCTOR
    //-------------------------------------------------------------------------

    constructor(address _stakingContract) public {
        poolId = 1;
        pinaRewards = IRewards(_stakingContract);
    }

    function setTicketCost(uint256 _price, uint256 _lotteryId)
        public
        onlyOwner
    {
        lotteryHistory[_lotteryId].costPerTicket = _price;
        emit TicketCostChanged(msg.sender, _lotteryId, _price);
    }

    function setPoolId(uint256 _poolId) public onlyOwner {
        poolId = _poolId;
    }

    // as the user can enter only once per lottery, it's enough to check if he has earned enough points
    function _checkEnoughPina(address _user, uint256 _lotteryId) internal {
        require(
            pinaRewards.earned(_user, poolId) >=
                lotteryHistory[_lotteryId].costPerTicket,
            "Not enough PINAs to enter the lottery"
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
        internal
        view
        returns (LotteryInfo storage)
    {
        return (lotteryHistory[_lotteryId]);
    }

    //-------------------------------------------------------------------------
    // MODIFIERS
    //-------------------------------------------------------------------------

    modifier onlyRandomGenerator() {
        require(msg.sender == address(randomGenerator), "Only RNG address");
        _;
    }

    function createNewLottery(
        uint16 _lotSize,
        uint8 _costPerTicket,
        uint256 _startingTime,
        uint256 _closingTime
    ) public onlyOwner returns (uint256 lotteryId) {
        require(
            _lotSize != 0 && _costPerTicket != 0,
            "Lot size and Ticket cost cannot be 0"
        );
        require(
            _startingTime != 0 && _startingTime < _closingTime,
            "Timestamps for lottery invalid"
        );
        // Incrementing lottery ID
        lotteryCounter = lotteryCounter.add(1);
        lotteryId = lotteryCounter;
        uint256 lotterySize = 2;
        uint16[] memory winningNumbers = new uint16[](lotterySize);
        uint16[] memory boosters = new uint16[](0);
        Status lotteryStatus;
        if (_startingTime >= getCurrentTime()) {
            lotteryStatus = Status.Open;
        } else {
            lotteryStatus = Status.Planned;
        }
        // Saving data in struct
        LotteryInfo memory newLottery = LotteryInfo(
            lotteryId,
            lotteryStatus,
            _lotSize,
            _costPerTicket,
            _startingTime,
            _closingTime,
            winningNumbers
        );
        lotteryHistory[lotteryId] = newLottery;
    }

    function getCurrentTime() public view returns (uint256) {
        return block.timestamp;
    }

    function drawWinningNumbers(uint256 _lotteryId, uint256 _seed)
        external
        onlyOwner
    {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];

        require(lottery.closingTime < block.timestamp);
        if (lottery.status == Status.Open) {
            lottery.status == Status.Closed;
        }
        require(lottery.status == Status.Closed);
        requestId_ = randomGenerator.getRandomNumber(_lotteryId, _seed);
        // Emits that random number has been requested
        emit RequestNumbers(_lotteryId, requestId_);
    }

    function numbersDrawn(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) internal onlyRandomGenerator {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        uint16 sizeOfLottery_ = lottery.lotSize;
        uint256 maxValidRange_ = participants[_lotteryId].length;
        lottery.winningNumbers = _split(
            _randomNumber,
            sizeOfLottery_,
            maxValidRange_
        );
    }

    function cancelLottery(uint256 _lotteryId) public onlyOwner {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Canceled;
    }

    function buyOneTicket(uint256 _lotteryId) public {
        require(
            participantToId[_lotteryId][msg.sender] == 0,
            "Already bought ticket to this lottery"
        );

        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        if (
            lottery.status == Status.Planned &&
            lottery.startingTime < block.timestamp
        ) {
            lottery.status = Status.Open;
        }
        if (
            lottery.status == Status.Open &&
            lottery.closingTime < block.timestamp
        ) {
            lottery.status = Status.Closed;
        }
        require(lottery.status == Status.Open, "Lottery not open");
        _checkEnoughPina(msg.sender, _lotteryId);

        participants[_lotteryId].push(msg.sender);

        uint256 participantId = participants[_lotteryId].length - 1;
        participant[_lotteryId][participantId] = msg.sender;
        participantToId[_lotteryId][msg.sender] = participantId;
    }

    function _split(
        uint256 _randomNumber,
        uint16 sizeOfLottery_,
        uint256 maxValidRange_
    ) internal view returns (uint16[] memory) {
        // Temporary storage for winning numbers
        uint16[] memory winningNumbers = new uint16[](sizeOfLottery_);
        // Loops the size of the number of tickets in the lottery
        for (uint256 i = 0; i < sizeOfLottery_; i++) {
            // Encodes the random number with its position in loop
            bytes32 hashOfRandom = keccak256(
                abi.encodePacked(_randomNumber, i)
            );
            // Casts random number hash into uint256
            uint256 numberRepresentation = uint256(hashOfRandom);
            // Sets the winning number position to a uint16 of random hash number
            winningNumbers[i] = uint16(
                numberRepresentation.mod(maxValidRange_)
            );
        }
        return winningNumbers;
    }

    function completeLottery(uint256 _lotteryId) public onlyOwner {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Completed;
        uint16 winningNumber;
        for (uint256 i = 0; i < lottery.lotSize; i++) {
            winningNumber = lottery.winningNumbers[i];
            winningParticipants[_lotteryId][winningNumber] = true;
        }
    }

    function redeemNFT(uint256 _lotteryId) public {
        require(lotteryHistory[_lotteryId].status == Status.Completed);
        uint256 winningNumber = participantToId[_lotteryId][msg.sender];
        require(winningParticipants[_lotteryId][winningNumber] == true);

        //mint
    }
}
