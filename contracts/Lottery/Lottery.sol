pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/IMemeXNFT.sol";

contract Lottery is Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private lotteryCounter;

    bytes32 internal requestId_;

    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;
    IRewards public rewardsContract;

    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    // participant address => lottery ids he entered
    mapping(address => uint256[]) internal participantHistory;

    //lotteryid => prizeIds[]
    mapping(uint256 => uint256[]) internal prizes;

    //lotteryid => address => participantInfo
    mapping(uint256 => mapping(address => ParticipantInfo))
        internal participants;

    //this maps the entries a user received when buying a ticket or boost
    //lotteryId => number => address
    mapping(uint256 => mapping(uint256 => address)) participantEntries;

    enum Status {
        Planned, // The lottery is only planned, cant buy tickets yet
        Canceled, // A lottery that got canceled
        Open, // Entries are open
        Closed, // Entries are closed. Must be closed to draw numbers
        Completed // The lottery has been completed and the numbers drawn
    }

    struct ParticipantInfo {
        address participantAddress;
        bool isBooster;
        uint256 prizeId;
        bool prizeClaimed;
        uint32 entries;
    }

    // Information about lotteries
    struct LotteryInfo {
        uint256 lotteryID; // ID for lotto
        Status status; // Status for lotto
        uint256 ticketCostPinas; // Cost per ticket in points/tokens
        uint256 ticketCostCoins; // Cost per ticket in FTM
        uint256 boostCost; // cost to boost the odds
        uint256 startingTime; // Timestamp to start the lottery
        uint256 closingTime; // Timestamp for end of entries
        IMemeXNFT nftContract; // reference to the NFT Contract
        Counters.Counter entriesCount; // count the number of entries (each ticket + boost bought)
        Counters.Counter participantsCount; // number of participants
        uint32 maxParticipants; // max number of participants
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

    event PrizeClaimed(
        uint256 lotteryId,
        address participantAddress,
        uint256 prizeId
    );

    constructor(address _rewardsContract) {
        rewardsContract = IRewards(_rewardsContract);
    }

    function setTicketCostPinas(uint256 _price, uint256 _lotteryId)
        public
        onlyOwner
    {
        lotteryHistory[_lotteryId].ticketCostPinas = _price;
        emit TicketCostChanged(msg.sender, _lotteryId, _price);
    }

    function _burnPinasToken(
        address _user,
        IRewards rewardsToken,
        uint256 _amount
    ) internal {
        require(
            rewardsToken.balanceOf(_user) >= _amount,
            "Not enough PINA tokens to enter the lottery"
        );
        rewardsToken.burnPinas(_user, _amount);
    }

    function _burnUserPoints(address _user, uint256 _amount) internal {
        rewardsContract.burnUserPoints(_user, _amount);
    }

    function setRewardsContract(address _rewardsContract) public onlyOwner {
        rewardsContract = IRewards(_rewardsContract);
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

    function getParticipantHistory(address _participantAddress)
        public
        view
        returns (uint256[] memory)
    {
        return participantHistory[_participantAddress];
    }

    /**
     * @notice Get the number of entries (each ticket and each boost provide an entry).
     * @param _lotteryId The lottery ID
     * @return Amount entries for a lottery (number of tickets and boosts bought)
     */
    function getTotalEntries(uint256 _lotteryId) public view returns (uint256) {
        return lotteryHistory[_lotteryId].entriesCount.current();
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

    /**
     * @notice Get the number of participants in a lottery.
     * @param _lotteryId The lottery ID
     * @return Amount of different addresses that have entered the lottery
     */
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

    /**
     * @notice Changes the prizes for a lottery.
     * @param _lotteryId The lottery ID
     * @param _prizeIds array of uint256's that represent unique prize ids
     */
    function setPrizes(uint256 _lotteryId, uint256[] calldata _prizeIds)
        public
        onlyOwner
    {
        require(
            _lotteryId <= lotteryCounter.current(),
            "Lottery id does not exist"
        );
        require(_prizeIds.length > 0, "No prize ids");
        prizes[_lotteryId] = _prizeIds;
        emit PrizesChanged(_lotteryId, prizes[_lotteryId].length);
    }

    /**
     * @notice Creates a new lottery.
     * @param _costPerTicketPinas cost in wei per ticket in points/tokens (token only when using ERC20 on the rewards contract)
     * @param _costPerTicketCoins cost in wei per ticket in FTM
     * @param _startingTime timestamp to begin lottery entries
     * @param _closingTime timestamp for end of entries
     * @param _prizeIds array of uint256's that represent unique prize ids
     * @param _nftContract reference to the NFT contract
     * @param _boostCost cost in wei (FTM) for users to boost their odds
     * @param _maxParticipants max number of participants
     */
    function createNewLottery(
        uint256 _costPerTicketPinas,
        uint256 _costPerTicketCoins,
        uint256 _startingTime,
        uint256 _closingTime,
        IMemeXNFT _nftContract,
        uint256[] calldata _prizeIds,
        uint256 _boostCost,
        uint32 _maxParticipants
    ) public onlyOwner returns (uint256 lotteryId) {
        require(
            _startingTime != 0 && _startingTime < _closingTime,
            "Timestamps for lottery invalid"
        );
        // Incrementing lottery ID
        lotteryCounter.increment();
        lotteryId = lotteryCounter.current();
        Status lotteryStatus;
        if (_startingTime <= block.timestamp) {
            lotteryStatus = Status.Open;
        } else {
            lotteryStatus = Status.Planned;
        }
        // Saving data in struct
        LotteryInfo memory newLottery = LotteryInfo(
            lotteryId,
            lotteryStatus,
            _costPerTicketPinas,
            _costPerTicketCoins,
            _boostCost,
            _startingTime,
            _closingTime,
            _nftContract,
            Counters.Counter(0),
            Counters.Counter(0),
            _maxParticipants
        );
        prizes[lotteryId] = _prizeIds;
        emit PrizesChanged(lotteryId, _prizeIds.length);
        lotteryHistory[lotteryId] = newLottery;
    }

    /**
     * @notice Used to check the latest lottery id.
     * @return Latest lottery id created.
     */
    function getCurrentLotteryId() public view returns (uint256) {
        return (lotteryCounter.current());
    }

    /**
     * @notice Called by the Memex team to request a random number to a particular lottery.
     * @param _lotteryId ID of the lottery the random number is for
     */
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
        require(lottery.status == Status.Closed, "Lottery must be closed");
        requestId_ = randomGenerator.getRandomNumber(_lotteryId);
        // Emits that random number has been requested
        emit RequestNumbers(_lotteryId, requestId_);
    }

    /**
     * @notice Callback function called by the RNG contract after receiving the chainlink response.
     * Will use the received random number to assign prizes to random participants.
     * @param _lotteryId ID of the lottery the random number is for
     * @param _requestId ID of the request that was sent to the RNG contract
     * @param _randomNumber Random number provided by the VRF chainlink oracle
     */
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
        uint256 totalEntries = lottery.entriesCount.current();

        // if there are less participants than prizes, reduce the number of prizes
        if (totalParticipants_ < numberOfPrizes_) {
            numberOfPrizes_ = uint16(totalParticipants_);
        }
        // Loops through each prize assigning to a position on the entries array
        for (uint16 i = 0; i < numberOfPrizes_; i++) {
            // Encodes the random number with its position in loop
            bytes32 hashOfRandom = keccak256(
                abi.encodePacked(_randomNumber, i)
            );
            // Casts random number hash into uint256
            uint256 numberRepresentation = uint256(hashOfRandom);
            // Sets the winning number position to a uint16 of random hash number
            uint256 winningNumber = uint256(
                numberRepresentation % totalEntries
            );
            // defines the winner
            bool winnerFound = false;
            do {
                address winnerAddress = participantEntries[_lotteryId][
                    winningNumber
                ];
                ParticipantInfo storage participant = participants[_lotteryId][
                    winnerAddress
                ];
                if (participant.prizeId != 0) {
                    // If address is already a winner pick the next number until a new winner is found
                    winningNumber++;
                    winningNumber = winningNumber % totalEntries;
                } else {
                    participant.prizeId = prizes[_lotteryId][i];
                    winnerFound = true;
                }
            } while (winnerFound == false);
        }
        lottery.status = Status.Completed;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    /**
     * @notice Change the lottery state to canceled.
     * @param _lotteryId ID of the lottery to canccel
     */
    function cancelLottery(uint256 _lotteryId) public onlyOwner {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Canceled;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    /**
     * @notice Function called by users to buy lottery tickets
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param numberOfTickets Number of tickets to buy
     */
    function buyTickets(uint256 _lotteryId, uint8 numberOfTickets)
        public
        payable
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        if (lottery.maxParticipants != 0) {
            require(
                lottery.participantsCount.current() < lottery.maxParticipants,
                "Lottery is full"
            );
        }
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
        require(lottery.status == Status.Open, "Lottery is not open");

        IRewards rewardsToken = rewardsContract.getRewardToken();

        uint256 totalCostInPoints = numberOfTickets * lottery.ticketCostPinas;
        if (totalCostInPoints > 0) {
            // if the pool in use is rewarding ERC-20 tokens we burn the ticket cost
            if (address(rewardsToken) != address(0)) {
                _burnPinasToken(msg.sender, rewardsToken, totalCostInPoints);
            } else {
                // if the pool is not using tokens we just handle the reward as points
                _burnUserPoints(msg.sender, totalCostInPoints);
            }
        }
        uint256 totalCostInCoins = numberOfTickets * lottery.ticketCostCoins;
        if (totalCostInCoins > 0) {
            require(
                msg.value >= totalCostInCoins,
                "Didn't transfer enough funds to buy tickets"
            );
        }
        ParticipantInfo memory participantStored = participants[_lotteryId][
            msg.sender
        ];
        if (participantStored.participantAddress == address(0)) {
            participantHistory[msg.sender].push(_lotteryId);
            ParticipantInfo memory newParticipant = ParticipantInfo(
                msg.sender,
                false,
                0,
                false,
                numberOfTickets
            );
            lottery.participantsCount.increment();
            participants[_lotteryId][msg.sender] = newParticipant;
        } else {
            participantStored.entries += numberOfTickets;
        }
        for (uint8 i = 0; i < numberOfTickets; i++) {
            assignNewEntryToParticipant(_lotteryId, msg.sender);
        }
    }

    /**
     * @notice Function called when user buys a ticket or boost. Gives the user a new lottery entry.
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param _participantAddress Address of the participant that will receive the new entry
     */
    function assignNewEntryToParticipant(
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
        participantEntries[_lotteryId][
            lottery.entriesCount.current()
        ] = _participantAddress;
        emit NumberAssignedToParticipant(
            _lotteryId,
            lottery.entriesCount.current(),
            _participantAddress
        );
        lottery.entriesCount.increment();
    }

    /**
     * @notice Function called to check if a user boosted on a particular lottery.
     * @param _lotteryId ID of the lottery to check if user boosted
     * @param _participantAddress Address of the participant to check
     */
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

    /**
     * @notice Boost the participant odds on the lottery.
     * @param _lotteryId ID of the lottery to boost
     * @param _participantAddress Address of the participant that will receive the boost
     */
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
            msg.value >= lotteryHistory[_lotteryId].boostCost,
            "Not enough tokens to boost"
        );

        participant.isBooster = true;
        assignNewEntryToParticipant(_lotteryId, _participantAddress);
    }

    /**
     * @notice Function called to check if a user won a prize.
     * @param _lotteryId ID of the lottery to check if user won
     * @param _address Address of the participant to check
     * @return true if the winner won a prize, with the prize id and if the prize was already claimed
     */
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

    /**
     * @notice Function called to check if the caller won a prize.
     * @param _lotteryId ID of the lottery to check if user won
     * @return true if the winner won a prize, with the prize id and if the prize was already claimed
     */
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

    /**
     * @notice Called to mint a prize to the winner.
     * @param _lotteryId ID of the lottery to check if user won
     */
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
        nftContract.create(
            msg.sender,
            participant.prizeId,
            1,
            1,
            "",
            _lotteryId
        );
        emit PrizeClaimed(
            _lotteryId,
            participant.participantAddress,
            participant.prizeId
        );
    }

    /**
     * @notice Function called to withdraw funds (FTM) from the contract.
     * @param _to Recipient of the funds
     * @param _amount Amount to withdraw
     */
    function withdraw(address payable _to, uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance);
        _to.transfer(_amount);
    }
}
