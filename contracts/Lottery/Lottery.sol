//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/IMemeXNFT.sol";

contract Lottery is Ownable {  // spider-g: , ILottery
    uint8 public maxEntries; // spider-g: rename to something like maxTicketsPerParticipantPerLottery

    bytes32 internal requestId_;

    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;
    IRewards public rewardsContract;

    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    uint256[] internal lotteries;

    // spider-g: why not store this in LotteryInfo? 
    // spider-g: also, maybe rename it to prizesMerkleRoots (initially I thought this was used for the points merkle tree)
    mapping(uint256 => bytes32) internal merkleRoots; 

    // participant address => lottery ids he entered
    mapping(address => uint256[]) public participantHistory;

    //lotteryid => prizeIds
    mapping(uint256 => PrizeInfo[]) internal prizes;

    struct PrizeInfo {
        uint256 prizeId;
        uint16 maxSupply;
    }

    // prizeId => number of times the prize can be claimed
    mapping(uint256 => uint32) public prizeMaxSupply; // spider-g: isn't this information already in PrizeInfo?

    //lotteryid => address => participantInfo
    // spider-g: if a user enters a lottery 10 times, only one entry is allowed here; but some entries might be boosted while others won't be
    mapping(uint256 => mapping(address => ParticipantInfo))
        internal participants;

    struct ParticipantInfo {
        bool isBooster;
        bool prizeClaimed;
        uint8 entries;
    }

    //loteryId => randomNumber received from RNG
    mapping(uint256 => uint256) public randomSeeds; // spider-g: why not store this in LotteryInfo?

    // if a user buys 10 tickets his address will occupy 10 positions in this array
    //lotteryId => address array
    mapping(uint256 => address[]) participantEntries;

    // spider-g: I don't feel like the "planned" status is necessary - it's either open, but hasn't started yet, or the other closed statuses
    // spider-g: Even if it's still "planned", the user can buyTicket() and the status changes to "Open", so "Planned" isn't really blocking anything
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
        uint256 ticketCostPinas; // Cost per ticket in points/tokens
        uint256 ticketCostCoins; // Cost per ticket in FTM
        uint256 boostCost; // cost to boost the odds // spider-g: is this in pinas? ftm? memes? or eth?
        uint256 startTime; // Timestamp where users can start buying tickets // spider-g: timestamps can be stored in uint32
        uint256 closingTime; // Timestamp where ticket sales end // spider-g: timestamps can be stored in uint32
        IMemeXNFT nftContract; // reference to the NFT Contract
        uint32 participantsCount; // number of participants
        uint32 maxParticipants; // max number of participants // spider-g: might need to reorder and re-type the properties for better on-chain storage https://medium.com/@novablitz/storing-structs-is-costing-you-gas-774da988895e
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
    event NewEntry(
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
        // spider-g: should require lottery status = planned
        lotteryHistory[_lotteryId].ticketCostPinas = _price;
        emit TicketCostChanged(msg.sender, _lotteryId, _price);
    }

    function setMerkleRoot(uint256 _lotteryId, bytes32 _root) public onlyOwner {
        // spider-g: should required lottery status = closed
        merkleRoots[_lotteryId] = _root;
    }

    function setMaxEntries(uint8 _maxEntries) public onlyOwner {
        maxEntries = _maxEntries;
    }

    function _burnUserPoints(address _user, uint256 _amount)
        internal
        returns (uint256)
    {
        return rewardsContract.burnUserPoints(_user, _amount);
    }

    function setRewardsContract(address _rewardsContract) public onlyOwner {
        rewardsContract = IRewards(_rewardsContract);
    }

    function changeCloseTime(uint256 _lotteryId, uint256 _time)
        public
        onlyOwner
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.startTime > 0, "Lottery id not found");
        require(
            _time > lottery.startTime,
            "Close time must be after start time"
        );
        // spider-g: should require status = planned or open
        lotteryHistory[_lotteryId].closingTime = _time;
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

    function getPrizes(uint256 _lotteryId)
        public
        view
        returns (PrizeInfo[] memory)
    {
        return prizes[_lotteryId];
    }

    function prizeClaimed(uint256 _lotteryId, address _participant)
        public
        view
        returns (bool)
    {
        return participants[_lotteryId][_participant].prizeClaimed;
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
        return participantEntries[_lotteryId].length;
    }

    function getLotteryCount() public view returns (uint256) {
        return lotteries.length;
    }

    function getLotteryIds() public view returns (uint256[] memory) {
        return lotteries;
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
        return lotteryHistory[_lotteryId].participantsCount;
    }

    modifier onlyRandomGenerator() {
        require(msg.sender == address(randomGenerator), "Only RNG address");
        _;
    }

    /**
     * @notice Defines prizes for a lottery.
     * @param _lotteryId The lottery ID
     * @param _prizeIds array with prize ids
     * @param _prizeAmounts array with prize supply
     */
    function addPrizes(
        uint256 _lotteryId,
        uint256[] calldata _prizeIds,
        uint16[] calldata _prizeAmounts
    ) public onlyOwner {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        require(lottery.startTime > 0, "Lottery does not exist");
        require(_prizeIds.length > 0, "Number of prizes can't be 0");
        require(
            _prizeIds.length == _prizeAmounts.length,
            "Number of prize ids and amounts must be equal"
        );
        IMemeXNFT nftContract = lottery.nftContract;
        for (uint8 i = 0; i < _prizeIds.length; i++) {
            nftContract.createTokenType(
                _prizeIds[i],
                _prizeAmounts[i],
                _lotteryId
            );
            prizes[_lotteryId].push(PrizeInfo(_prizeIds[i], _prizeAmounts[i]));
        }

        emit PrizesChanged(_lotteryId, _prizeIds.length);
    }

    /**
     * @notice Creates a new lottery.
     * @param _costPerTicketPinas cost in wei per ticket in points/tokens (token only when using ERC20 on the rewards contract)
     * @param _costPerTicketCoins cost in wei per ticket in FTM
     * @param _startTime timestamp to begin lottery entries
     * @param _nftContract reference to the NFT contract
     * @param _boostCost cost in wei (FTM) for users to boost their odds
     * @param _maxParticipants max number of participants. Use 0 for unlimited
     */
    function createNewLottery(
        uint256 _costPerTicketPinas,
        uint256 _costPerTicketCoins,
        uint256 _startTime,
        uint256 _closeTime,
        IMemeXNFT _nftContract,
        uint256 _boostCost,
        uint16 _maxParticipants,
        address _artistAddress,
        string calldata _dropMetadataURI
    ) public onlyOwner returns (uint256 lotteryId) {
        Status lotteryStatus;
        if (_startTime <= block.timestamp) {
            lotteryStatus = Status.Open;
        } else {
            lotteryStatus = Status.Planned;
        }
        lotteryId = _nftContract.createCollection(
            _artistAddress,
            _dropMetadataURI
        );
        LotteryInfo memory newLottery = LotteryInfo(
            lotteryId,
            lotteryStatus,
            _costPerTicketPinas,
            _costPerTicketCoins,
            _boostCost,
            _startTime,
            _closeTime,
            _nftContract,
            0,
            _maxParticipants
        );
        lotteryHistory[lotteryId] = newLottery;
        lotteries.push(lotteryId);
        return lotteryId;
    }

    /**
     * @notice Called by the Memex team to request a random number to a particular lottery.
     * @param _lotteryId ID of the lottery the random number is for
     */
    function requestRandomNumber(uint256 _lotteryId) external onlyOwner {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(prizes[_lotteryId].length != 0, "No prizes for this lottery");
        // DISABLED FOR TESTS require(lottery.closingTime < block.timestamp);
        if (lottery.status == Status.Open) {
            lottery.status = Status.Closed;
            // spider-g: emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        // should fail if the lottery is completed (already called drawWinningNumbers and received a response)
        require(lottery.status == Status.Closed, "Lottery must be closed!");
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
    function receiveRandomNumber(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) external onlyRandomGenerator {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.status == Status.Closed, "Lottery must be closed");
        emit ResponseReceived(_requestId);
        lottery.status = Status.Completed;
        randomSeeds[_lotteryId] = _randomNumber;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    function getParticipantEntries(uint256 _lotteryId)
        public
        view
        returns (address[] memory)
    {
        return participantEntries[_lotteryId];
    }

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
    function cancelLottery(uint256 _lotteryId) public onlyOwner { // spider-g: if there are participants, should we refund their points?
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Canceled;
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    /**
     * @notice Function called by users to claim rewards and buy lottery tickets on same tx
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param numberOfTickets Number of tickets to buy
     * @param _points Total user claimable points
     * @param _proof Proof of the user's claimable points
     */
    function claimRewardAndBuyTickets( // spider-g: I think this name is a little confusing. Maybe claimPointsAndBuyTickets() ?
        uint256 _lotteryId,
        uint8 numberOfTickets,
        uint256 _points,
        bytes32[] calldata _proof
    ) public payable returns (uint256) {
        if (rewardsContract.totalPointsClaimed(msg.sender) < _points) {
            rewardsContract.claimRewardWithProof(msg.sender, _points, _proof); // spider-g: claimPointsWithProof() ?
        }
        return buyTickets(_lotteryId, numberOfTickets);
    }

    /**
     * @notice Function called by users to buy lottery tickets
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param numberOfTickets Number of tickets to buy
     */
    function buyTickets(uint256 _lotteryId, uint8 numberOfTickets)
        public
        payable
        returns (uint256)
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        uint256 remainingPoints;
        if (lottery.maxParticipants != 0) {
            require(
                lottery.participantsCount < lottery.maxParticipants,
                "Lottery is full"
            );
        }
        if (maxEntries > 0) {
            require(
                participants[_lotteryId][msg.sender].entries +
                    numberOfTickets <=
                    maxEntries,
                "Can't buy this amount of tickets"
            );
        }
        if (
            lottery.status == Status.Planned &&
            lottery.startTime <= block.timestamp
        ) {
            lottery.status = Status.Open;
            emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        if (
            lottery.status == Status.Open &&
            lottery.closingTime < block.timestamp
        ) {
            lottery.status = Status.Closed;
            // spider-g: maybe you could call requestRandomNumber at this point?
            emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        require(lottery.status == Status.Open, "Lottery is not open");

        uint256 totalCostInPoints = numberOfTickets * lottery.ticketCostPinas;
        if (totalCostInPoints > 0) {
            remainingPoints = rewardsContract.availablePoints(msg.sender);
            require(
                remainingPoints >= totalCostInPoints,
                "Not enough points to buy tickets"
            );
            remainingPoints = _burnUserPoints(msg.sender, totalCostInPoints);
        }
        uint256 totalCostInCoins = numberOfTickets * lottery.ticketCostCoins;
        if (totalCostInCoins > 0) {
            require(
                msg.value >= totalCostInCoins,
                "Didn't transfer enough funds to buy tickets"
            );
        }
        // spider-g: I find the name "entry" a little misleading - at first, I thought 1 purchase with N tickets would mean 1 entry. 
        // spider-g: Maybe rename it to "numTicketsBought" or something like that
        uint256 userEntries = participants[_lotteryId][msg.sender].entries;
        if (userEntries == 0) {
            participantHistory[msg.sender].push(_lotteryId);
            lottery.participantsCount++;
            ParticipantInfo memory participant = ParticipantInfo(
                false,
                false,
                numberOfTickets
            );
            participants[_lotteryId][msg.sender] = participant;
        } else {
            participants[_lotteryId][msg.sender].entries += numberOfTickets;
        }
        for (uint8 i = 0; i < numberOfTickets; i++) {
            assignNewEntryToParticipant(_lotteryId, msg.sender);
        }
        return remainingPoints;
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
        participantEntries[_lotteryId].push(_participantAddress); // spider-g: Maybe name it "participantTickets[]"?
        emit NewEntry(
            _lotteryId,
            participantEntries[_lotteryId].length,
            _participantAddress
        );
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
        return participants[_lotteryId][_participantAddress].isBooster;
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
        ParticipantInfo storage participant = participants[_lotteryId][
            _participantAddress
        ];
        require(
            lotteryHistory[_lotteryId].boostCost != 0,
            "Can't boost on this lottery"
        );
        require(participant.entries > 0, "Participant not found");
        require(
            participant.isBooster == false,
            "Participant already a booster"
        );
        // check if the transaction contains the boost cost
        // spider-g: what if the boost costs 2 and the users sends 5.000? shouldn't we require msg.value == boostCost?
        require(
            msg.value >= lotteryHistory[_lotteryId].boostCost,
            "Didn't send enough to boost"
        );

        participant.isBooster = true;
        assignNewEntryToParticipant(_lotteryId, _participantAddress);
    }

    function claimWithProof( // spider-g: Rename it to claimPrize()
        uint256 _lotteryId,
        address _winner,
        uint256 _prizeId,
        bytes32[] calldata _proof
    ) public {
        require(
            _verify(
                _leaf(_lotteryId, _winner, _prizeId),
                merkleRoots[_lotteryId],
                _proof
            ),
            "Invalid merkle proof"
        );
        ParticipantInfo storage participant = participants[_lotteryId][
            msg.sender
        ];
        require(
            participant.prizeClaimed == false,
            "Participant already claimed prize"
        );
        require(msg.sender == _winner, "Sender is not the winner address"); // spider-g: move to function top

        IMemeXNFT nftContract = lotteryHistory[_lotteryId].nftContract;

        participant.prizeClaimed = true;
        nftContract.mint(msg.sender, _prizeId, 1, "");
        emit PrizeClaimed(_lotteryId, msg.sender, _prizeId);
    }

    function _leaf(
        uint256 _lotteryId,
        address _winner,
        uint256 _prizeId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(_lotteryId, _winner, _prizeId));
    }

    function _verify(
        bytes32 _leafHash,
        bytes32 _root,
        bytes32[] memory _proof
    ) internal pure returns (bool) {
        return MerkleProof.verify(_proof, _root, _leafHash);
    }

    /**
     * @notice Function called to withdraw funds (native tokens) from the contract.
     * @param _to Recipient of the funds
     * @param _amount Amount to withdraw
     */
    function withdraw(address payable _to, uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance);
        _to.transfer(_amount);
    }
}
