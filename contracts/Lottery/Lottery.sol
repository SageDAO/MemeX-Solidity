pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IRandomNumberGenerator.sol";


/// SSS: Things to think about:
// Winning numbers should be generated based on reward points;
contract Lottery is Ownable {
    using SafeMath for uint256;

    
    // Address of the PINA token
    IERC20 internal pina;
    bytes32 internal requestId_;
    uint256 public priceOfTicket;
    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;

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



    event RequestNumbers(uint256 lotteryId, bytes32 requestId);
    event priceOfTokenSet(address operator, uint256 priceOfTicket);

    //-------------------------------------------------------------------------
    // CONSTRUCTOR
    //-------------------------------------------------------------------------

    constructor(address _pina) public {
        require(_pina != address(0), "Contract can't be 0 address");
        pina = IERC20(_pina);
    }

    function setPriceOfToken(uint256 _price) public onlyOwner(){
        priceOfTicket = _price;
        emit priceOfTokenSet(msg.sender, _price);
    }

    function initialize(address _IRandomNumberGenerator) external onlyOwner {
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


    function drawWinningNumbers(
        uint256 _lotteryId, 
        uint256 _seed
    ) 
        external 
        onlyOwner() 
    {


        requestId_ = randomGenerator.getRandomNumber(_lotteryId, _seed);
        // Emits that random number has been requested
        emit RequestNumbers(_lotteryId, requestId_);
    }

    function numbersDrawn(
        uint256 _lotteryId,
        bytes32 _requestId, 
        uint256 _randomNumber
    ) 
        internal
        onlyRandomGenerator()
    {
        
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        uint16 sizeOfLottery_ = lottery.lotSize;
        uint256 maxValidRange_ = participants[_lotteryId].length;
        lottery.winningNumbers = _split(_randomNumber, sizeOfLottery_,maxValidRange_);
    }

    function buyOneTicket(uint256 _lotteryId) public{
        require(pina.balanceOf(msg.sender) >= priceOfTicket);
        
        pina.transferFrom(msg.sender, address(this), priceOfTicket);
        participants[_lotteryId].push(msg.sender);

        uint256 participantId = participants[_lotteryId].length - 1;
        participant[_lotteryId][participantId] = msg.sender;
        participantToId[_lotteryId][msg.sender] = participantId;
        
    }

    function buyMultipleTicket(uint256 _lotteryId, uint256 _numberOfTickets) public{
        require(pina.balanceOf(msg.sender) >= priceOfTicket.mul(_numberOfTickets));
        for(uint i = 0; i< _numberOfTickets; i++){
            buyOneTicket(_lotteryId);
        }
    }
    
    function _split(
        uint256 _randomNumber,
        uint16 sizeOfLottery_,
        uint256 maxValidRange_
    ) 
        internal
        view 
        returns(uint16[] memory) 
    {
        // Temparary storage for winning numbers
        uint16[] memory winningNumbers = new uint16[](sizeOfLottery_);
        // Loops the size of the number of tickets in the lottery
        for(uint i = 0; i < sizeOfLottery_; i++){
            // Encodes the random number with its position in loop
            bytes32 hashOfRandom = keccak256(abi.encodePacked(_randomNumber, i));
            // Casts random number hash into uint256
            uint256 numberRepresentation = uint256(hashOfRandom);
            // Sets the winning number position to a uint16 of random hash number
            winningNumbers[i] = uint16(numberRepresentation.mod(maxValidRange_));
        }
    return winningNumbers;
    }

    function finaliseLottery(uint256 _lotteryId) public onlyOwner(){
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        uint16 winningNumber;
        for(uint256 i = 0; i<lottery.lotSize; i++){
            winningNumber = lottery.winningNumbers[i];
            winningParticipants[_lotteryId][winningNumber] = true;
        }
    }

    function redeemNFT(uint256 _lotteryId) public{
        uint256 winningNumber = participantToId[_lotteryId][msg.sender];
        require(winningParticipants[_lotteryId][winningNumber] == true);

        //mint
    }
}
