//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../../interfaces/ILottery.sol";

contract MemeXLottery is Ownable, ILottery {
    uint8 public maxTicketsPerParticipant;

    bytes32 internal requestId_;

    // Address of the randomness generator
    IRandomNumberGenerator public randomGenerator;
    IRewards public rewardsContract;

    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    uint256[] public lotteries;

    mapping(uint256 => bytes32) public prizeMerkleRoots;

    // participant address => lottery ids he entered
    mapping(address => uint256[]) public participantHistory;

    //lotteryid => prizeIds
    mapping(uint256 => PrizeInfo[]) public prizes;

    struct PrizeInfo {
        uint256 prizeId;
        uint16 maxSupply;
    }

    //lotteryid => address => participantInfo
    mapping(uint256 => mapping(address => ParticipantInfo)) public participants;

    struct ParticipantInfo {
        uint8 ticketsFromCoins;
        uint8 ticketsFromPoints;
        bool prizeClaimed;
    }

    //loteryId => randomNumber received from RNG
    mapping(uint256 => uint256) public randomSeeds;

    //lotteryId => address array
    mapping(uint256 => address[]) internal lotteryTickets;

    enum Status {
        Planned, // The lottery is only planned, cant buy tickets yet
        Canceled, // A lottery that got canceled
        Open, // Entries are open
        Closed, // Entries are closed. Must be closed to draw numbers
        Completed // The lottery has been completed and the numbers drawn
    }

    // Information about lotteries
    struct LotteryInfo {
        uint32 startTime; // Timestamp where users can start buying tickets
        uint32 closingTime; // Timestamp where ticket sales end
        uint32 participantsCount; // number of participants
        uint32 maxParticipants; // max number of participants
        uint256 lotteryID; // ID for lotto
        Status status; // Status for lotto
        uint256 ticketCostPinas; // Cost per ticket in points/tokens
        uint256 ticketCostCoins; // Cost per ticket in FTM
        IMemeXNFT nftContract; // reference to the NFT Contract
        uint256 defaultPrizeId; // prize all participants win if no other prizes are given
    }

    event ResponseReceived(bytes32 indexed _requestId);
    event PrizesChanged(uint256 indexed _lotteryId, uint256 numberOfPrizes);
    event LotteryStatusChanged(
        uint256 indexed _lotteryId,
        Status indexed _status
    );
    event RequestNumbers(uint256 indexed lotteryId, bytes32 indexed requestId);
    event TicketCostChanged(
        address operator,
        uint256 lotteryId,
        uint256 priceOfTicket
    );
    event NewEntry(
        uint256 indexed lotteryId,
        uint256 number,
        address indexed participantAddress
    );

    event PrizeClaimed(
        uint256 indexed lotteryId,
        address indexed participantAddress,
        uint256 indexed prizeId
    );

    constructor(address _rewardsContract) {
        rewardsContract = IRewards(_rewardsContract);
    }

    function setTicketCostPinas(uint256 _price, uint256 _lotteryId)
        public
        onlyOwner
    {
        require(
            lotteryHistory[_lotteryId].status == Status.Planned,
            "Lottery must be planned to change ticket cost"
        );
        lotteryHistory[_lotteryId].ticketCostPinas = _price;

        emit TicketCostChanged(msg.sender, _lotteryId, _price);
    }

    function setPrizeMerkleRoot(uint256 _lotteryId, bytes32 _root)
        public
        onlyOwner
    {
        prizeMerkleRoots[_lotteryId] = _root;
    }

    function setMaxTicketsPerParticipant(uint8 _maxTicketsPerParticipant)
        public
        onlyOwner
    {
        maxTicketsPerParticipant = _maxTicketsPerParticipant;
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

    function changeCloseTime(uint256 _lotteryId, uint32 _time)
        public
        onlyOwner
    {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(lottery.startTime > 0, "Lottery id not found");
        require(
            _time > lottery.startTime,
            "Close time must be after start time"
        );
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
        return lotteryTickets[_lotteryId].length;
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
        for (uint16 i = 0; i < _prizeIds.length; i++) {
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
     * @param _maxParticipants max number of participants. Use 0 for unlimited
     * @param _artistAddress wallet address of the artist
     * @param _defaultPrizeId default prize id
     * @param _royaltyPercentage royalty percentage for the drop in base points (200 = 2% )
     * @param _dropMetadataURI base URI for the drop metadata
     * @return lotteryId
     */
    function createNewLottery(
        uint256 _costPerTicketPinas,
        uint256 _costPerTicketCoins,
        uint32 _startTime,
        uint32 _closeTime,
        IMemeXNFT _nftContract,
        uint16 _maxParticipants,
        address _artistAddress,
        uint256 _defaultPrizeId,
        uint16 _royaltyPercentage,
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
            _royaltyPercentage,
            _dropMetadataURI
        );
        LotteryInfo memory newLottery = LotteryInfo(
            _startTime,
            _closeTime,
            0,
            _maxParticipants,
            lotteryId,
            lotteryStatus,
            _costPerTicketPinas,
            _costPerTicketCoins,
            _nftContract,
            _defaultPrizeId
        );
        lotteryHistory[lotteryId] = newLottery;
        lotteries.push(lotteryId);
        emit LotteryStatusChanged(lotteryId, lotteryStatus);
        return lotteryId;
    }

    /**
     * @notice Called by the Memex team to request a random number to a particular lottery.
     * @param _lotteryId ID of the lottery the random number is for
     */
    function requestRandomNumber(uint256 _lotteryId) external onlyOwner {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(prizes[_lotteryId].length != 0, "No prizes for this lottery");
        require(lottery.closingTime < block.timestamp, "Lottery is not closed");
        if (lottery.status == Status.Open) {
            lottery.status = Status.Closed;
            emit LotteryStatusChanged(_lotteryId, lottery.status);
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

    /**
     * @notice Returns de array of tickets (each purchase and boost provide a ticket).
     * @param _lotteryId The lottery ID
     * @return Array with tickets for a lottery
     */
    function getLotteryTickets(uint256 _lotteryId)
        public
        view
        returns (address[] memory)
    {
        return lotteryTickets[_lotteryId];
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
    function cancelLottery(uint256 _lotteryId) public onlyOwner {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        require(
            lottery.status != Status.Completed,
            "Lottery already completed"
        );
        lottery.status = Status.Canceled;
        address[] memory tickets = lotteryTickets[_lotteryId];
        for (uint16 i = 0; i < tickets.length; i++) {
            rewardsContract.refundPoints(tickets[i], lottery.ticketCostPinas);
        }
        emit LotteryStatusChanged(_lotteryId, lottery.status);
    }

    /**
     * @notice Function called by users to claim points and buy lottery tickets on same tx
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param numberOfTickets Number of tickets to buy
     * @param _points Total user claimable points
     * @param _proof Proof of the user's claimable points
     */
    function claimPointsAndBuyTickets(
        uint256 _lotteryId,
        uint8 numberOfTickets,
        uint256 _points,
        bytes32[] calldata _proof
    ) public payable returns (uint256) {
        if (rewardsContract.totalPointsEarned(msg.sender) < _points) {
            rewardsContract.claimPointsWithProof(msg.sender, _points, _proof);
        }
        return buyTickets(_lotteryId, numberOfTickets, true);
    }

    /**
     * @notice Function called by users to buy lottery tickets using PINA points
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param numberOfTickets Number of tickets to buy
     */
    function buyTickets(
        uint256 _lotteryId,
        uint8 numberOfTickets,
        bool _usePoints
    ) public payable returns (uint256) {
        LotteryInfo storage lottery = lotteryHistory[_lotteryId];
        uint256 remainingPoints;
        if (lottery.maxParticipants != 0) {
            require(
                lottery.participantsCount < lottery.maxParticipants,
                "Lottery is full"
            );
        }
        ParticipantInfo storage participantInfo = participants[_lotteryId][
            msg.sender
        ];
        uint256 numTicketsBought = participantInfo.ticketsFromPoints +
            participantInfo.ticketsFromCoins;
        if (maxTicketsPerParticipant > 0) {
            require(
                numTicketsBought + numberOfTickets <= maxTicketsPerParticipant,
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
            emit LotteryStatusChanged(_lotteryId, lottery.status);
        }
        require(lottery.status == Status.Open, "Lottery is not open");
        if (_usePoints) {
            uint256 totalCostInPoints = numberOfTickets *
                lottery.ticketCostPinas;
            require(totalCostInPoints > 0, "Can't buy tickets with points");
            remainingPoints = rewardsContract.availablePoints(msg.sender);
            require(
                remainingPoints >= totalCostInPoints,
                "Not enough points to buy tickets"
            );
            remainingPoints = _burnUserPoints(msg.sender, totalCostInPoints);
            participantInfo.ticketsFromPoints += numberOfTickets;
        } else {
            uint256 totalCostInCoins = numberOfTickets *
                lottery.ticketCostCoins;
            require(totalCostInCoins > 0, "Can't buy tickets with coins");
            require(
                msg.value >= totalCostInCoins,
                "Didn't transfer enough funds to buy tickets"
            );
            if (lottery.ticketCostPinas != 0) {
                require(
                    participantInfo.ticketsFromPoints > 0,
                    "Participant not found"
                );
            }
            participantInfo.ticketsFromCoins += numberOfTickets;
        }
        if (numTicketsBought == 0) {
            participantHistory[msg.sender].push(_lotteryId);
            lottery.participantsCount++;
            participants[_lotteryId][msg.sender] = participantInfo;
        }
        for (uint8 i = 0; i < numberOfTickets; i++) {
            assignNewTicketToParticipant(_lotteryId, msg.sender);
        }
        return remainingPoints;
    }

    /**
     * @notice Function called when user buys a ticket. Gives the user a new lottery entry.
     * @param _lotteryId ID of the lottery to buy tickets for
     * @param _participantAddress Address of the participant that will receive the new entry
     */
    function assignNewTicketToParticipant(
        uint256 _lotteryId,
        address _participantAddress
    ) private {
        lotteryTickets[_lotteryId].push(_participantAddress);
        emit NewEntry(
            _lotteryId,
            lotteryTickets[_lotteryId].length,
            _participantAddress
        );
    }

    function claimPrize(
        uint256 _lotteryId,
        address _winner,
        uint256 _prizeId,
        bytes32[] calldata _proof
    ) public {
        require(
            _verify(
                _leaf(_lotteryId, _winner, _prizeId),
                prizeMerkleRoots[_lotteryId],
                _proof
            ),
            "Invalid merkle proof"
        );
        ParticipantInfo storage participant = participants[_lotteryId][_winner];
        require(
            participant.prizeClaimed == false,
            "Participant already claimed prize"
        );

        IMemeXNFT nftContract = lotteryHistory[_lotteryId].nftContract;

        participant.prizeClaimed = true;
        nftContract.mint(_winner, _prizeId, 1, _lotteryId, "");
        emit PrizeClaimed(_lotteryId, _winner, _prizeId);
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
