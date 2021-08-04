pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        uint256 startingBlock; // Block for start of lotto
        uint256 closingBlock; // Block for end of entries
        uint16[] winningNumbers; // The winning numbers
        address[] boosters; // Accounts that boosted the participation on this lottery
    }

    //-------------------------------------------------------------------------
    // CONSTRUCTOR
    //-------------------------------------------------------------------------

    constructor(address _pina) public {
        require(_pina != address(0), "Contract can't be 0 address");
        pina = IERC20(_pina);
    }

    function initialize(address _IRandomNumberGenerator)
        external
        initializer
        onlyOwner
    {
        require(
            _IRandomNumberGenerator != address(0),
            "Contracts cannot be 0 address"
        );
        nft_ = ILotteryNFT(_lotteryNFT);
        randomGenerator_ = IRandomNumberGenerator(_IRandomNumberGenerator);
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
        if (isBooster(_lotteryId, _address)) {
            ticketPrice = ticketPrice.div(2);
        }
        totalCost = ticketPrice.mul(_numberOfTickets);
    }

    function isBooster(uint256 _lotteryId, address _address)
        internal
        view
        returns (bool)
    {
        // check if the address boosted on this lottery
        return false;
    }
}
