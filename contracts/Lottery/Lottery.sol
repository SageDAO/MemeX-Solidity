pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IRandomNumberGenerator.sol";

contract Lottery is Ownable {
    using SafeMath for uint256;

    // Address of the PINA token
    IERC20 internal pina;
    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;

    uint256 private lotteryCounter;
    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    enum Status {
        Planned, // The lottery is only planned, cant buy tickets yet
        Canceled, // A planned lottery that got canceled before any tickets bought
        Open, // The lottery is open for ticket purchases
        Closed, // The lottery is no longer open for ticket purchases. Must be closed before requesting the RNG
        Completed // The lottery has been closed and the numbers drawn
    }

    // Information about lotteries
    struct LotteryInfo {
        uint256 lotteryID; // ID for lotto
        Status lotteryStatus; // Status for lotto
        uint16 lotSize; // number of NFTs on this lot
        uint8 costPerTicket; // Cost per ticket in $PINA
        uint256 startingTime; // Timestamp to start the lottery
        uint256 closingTime; // Timestamp for end of entries
        uint16[] winningNumbers; // The winning numbers
    }

    //-------------------------------------------------------------------------
    // CONSTRUCTOR
    //-------------------------------------------------------------------------

    constructor(address _pina) public {
        require(_pina != address(0), "Contract can't be 0 address");
        pina = IERC20(_pina);
    }

    function initialize(address _IRandomNumberGenerator) external onlyOwner {
        require(
            _IRandomNumberGenerator != address(0),
            "Contracts cannot be 0 address"
        );
        randomGenerator = IRandomNumberGenerator(_IRandomNumberGenerator);
    }

    function getLotteryInfo(uint256 _lotteryId)
        external
        view
        returns (LotteryInfo memory)
    {
        return (lotteryHistory[_lotteryId]);
    }

    //-------------------------------------------------------------------------
    // VIEW FUNCTIONS
    //-------------------------------------------------------------------------

    function costToBuyTickets(
        uint256 _lotteryId,
        uint8 _numberOfTickets,
        address _address
    ) external view returns (uint256 totalCost) {
        uint256 ticketPrice = lotteryHistory[_lotteryId].costPerTicket;
        totalCost = ticketPrice.mul(_numberOfTickets);
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
    ) external onlyOwner returns (uint256 lotteryId) {
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
        uint16[] memory winningNumbers = new uint16[](_lotSize);
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
}
