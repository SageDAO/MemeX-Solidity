pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/IMemeXNFT.sol";

/// SSS: Things to think about:
// Winning numbers should be generated based on reward points;
contract Lottery is Ownable {
    using SafeMath for uint256;

    bytes32 internal requestId_;

    uint256 public poolId;
    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;
    IRewards public pinaRewards;

    uint256 private lotteryCounter;
    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    //lotteryid => prizeIds[]
    mapping(uint256 => uint256[]) internal prizes;

    //lotteryid => participants
    mapping(uint256 => ParticipantInfo[]) internal participants;

    //lotteryId => participant address => participantId
    mapping(uint256 => mapping(address => uint256)) participantToId;

    enum Status {
        Planned, // The lottery is only planned, cant buy tickets yet
        Canceled, // A lottery that got canceled
        Open, // Entries are open
        Closed, // Entries are closed. Must be closed to draw numbers
        Completed // The lottery has been completed and the numbers drawn
    }

    struct ParticipantInfo {
        address participantAddress;
        bool winner;
        uint256 prizeId;
        bool prizeClaimed;
    }

    // Information about lotteries
    struct LotteryInfo {
        uint256 lotteryID; // ID for lotto
        Status status; // Status for lotto
        uint256 costPerTicket; // Cost per ticket in $PINA
        uint256 startingTime; // Timestamp to start the lottery
        uint256 closingTime; // Timestamp for end of entries
        IMemeXNFT nftContract;
    }

    event LotteryStatusChanged(uint256 _lotteryId, Status _status);
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
        uint8 _costPerTicket,
        uint256 _startingTime,
        uint256 _closingTime,
        IMemeXNFT _nftContract
    ) public onlyOwner returns (uint256 lotteryId) {
        require(_costPerTicket != 0, "Ticket cost cannot be 0");
        require(
            _startingTime != 0 && _startingTime < _closingTime,
            "Timestamps for lottery invalid"
        );
        // Incrementing lottery ID
        lotteryCounter = lotteryCounter.add(1);
        lotteryId = lotteryCounter;
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
            _costPerTicket,
            _startingTime,
            _closingTime,
            _nftContract
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
        require(prizes[_lotteryId].length != 0, "No prizes for this lottery");
        require(lottery.closingTime < block.timestamp);
        if (lottery.status == Status.Open) {
            lottery.status == Status.Closed;
        }
        require(
            lottery.status == Status.Closed,
            "Must be closed prior to draw"
        );
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
        uint16 numberOfPrizes_ = uint16(prizes[_lotteryId].length);
        uint256 totalParticipants_ = participants[_lotteryId].length;
        _assignPrizes(
            _randomNumber,
            numberOfPrizes_,
            totalParticipants_,
            _lotteryId
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
        _checkEnoughPina(msg.sender, _lotteryId);

        participants[_lotteryId].push(
            ParticipantInfo(msg.sender, false, 0, false)
        );

        uint256 participantId = participants[_lotteryId].length - 1;
        participantToId[_lotteryId][msg.sender] = participantId;
    }

    function _assignPrizes(
        uint256 _randomNumber,
        uint16 numberOfPrizes_,
        uint256 totalParticipants_,
        uint256 _lotteryId
    ) internal {
        // if there are less participants than prizes, reduce the number of prizes
        if (totalParticipants_ > numberOfPrizes_) {
            numberOfPrizes_ = uint16(totalParticipants_);
        }
        // Loops through the prizes in the lottery
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
            // Changes the participant with id = winningNumber to be winner and sets the prizeId
            participants[_lotteryId][winningNumber].winner = true;
            participants[_lotteryId][winningNumber].prizeId = prizes[
                _lotteryId
            ][i];
            // TODO: participant might already be winner, should pick another participant if so
        }
    }

    function isAddressWinner(uint256 _lotteryId, address _address)
        public
        view
        returns (bool)
    {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        require(lottery.status == Status.Completed, "Lottery not completed");
        uint256 participantId = participantToId[_lotteryId][msg.sender];
        return participants[_lotteryId][participantId].winner;
    }

    function isCallerWinner(uint256 _lotteryId) public view returns (bool) {
        return isAddressWinner(_lotteryId, msg.sender);
    }

    function completeLottery(uint256 _lotteryId) public onlyOwner {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Completed;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    function redeemNFT(uint256 _lotteryId) public {
        require(lotteryHistory[_lotteryId].status == Status.Completed);
        uint256 participantId = participantToId[_lotteryId][msg.sender];
        require(
            participants[_lotteryId][participantId].winner == true &&
                participants[_lotteryId][participantId].prizeClaimed == false
        );
        participants[_lotteryId][participantId].prizeClaimed = true;
        IMemeXNFT nftContract = lotteryHistory[_lotteryId].nftContract;
        nftContract.mint(
            msg.sender,
            participants[_lotteryId][participantId].prizeId,
            1,
            "", // TODO: what data?
            _lotteryId
        );
    }
}
