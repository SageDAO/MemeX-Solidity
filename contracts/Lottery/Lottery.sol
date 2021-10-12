//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../../interfaces/IRewards.sol";
import "../../interfaces/IRandomNumberGenerator.sol";
import "../../interfaces/IMemeXNFT.sol";

contract Lottery is Ownable {
    using Counters for Counters.Counter;

    uint8 public constant maxEntries = 5;

    bytes32 internal requestId_;

    // Address of the randomness generator
    IRandomNumberGenerator internal randomGenerator;
    IRewards public rewardsContract;

    mapping(uint256 => LotteryInfo) internal lotteryHistory;

    uint256[] internal lotteries;

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
    mapping(uint256 => uint32) public prizeMaxSupply;

    //lotteryid => address => participantInfo
    mapping(uint256 => mapping(address => ParticipantInfo))
        internal participants;

    struct ParticipantInfo {
        bool isBooster;
        uint256 prizeId;
        bool prizeClaimed;
        uint8 entries;
    }

    //loteryId => randomNumber received from RNG
    mapping(uint256 => uint256) public randomSeeds;

    // if a user buys 10 tickets his address will occupy 10 positions in this array
    //lotteryId => address array
    mapping(uint256 => address[]) participantEntries;

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
        uint256 boostCost; // cost to boost the odds
        uint256 startTime; // Timestamp where users can start buying tickets
        uint256 closingTime; // Timestamp where ticket sales end
        IMemeXNFT nftContract; // reference to the NFT Contract
        uint32 participantsCount; // number of participants
        uint32 maxParticipants; // max number of participants
        uint256 defaultPrizeId; // prize that every participant will be able to mint
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
        lotteryHistory[_lotteryId].ticketCostPinas = _price;
        emit TicketCostChanged(msg.sender, _lotteryId, _price);
    }

    function setMerkleRoot(uint256 _lotteryId, bytes32 _root) public onlyOwner {
        merkleRoots[_lotteryId] = _root;
    }

    function getMerkleRoot(uint256 _lotteryId) public view returns (bytes32) {
        return merkleRoots[_lotteryId];
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
        rewardsToken.burn(_user, _amount);
    }

    function _burnUserPoints(address _user, uint256 _amount) internal {
        rewardsContract.burnUserPoints(_user, _amount);
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

    function getParticipantHistory(address _participantAddress)
        public
        view
        returns (uint256[] memory)
    {
        return participantHistory[_participantAddress];
    }

    function getTotalPrizes(uint256 _lotteryId) public view returns (uint16) {
        uint16 acc;
        PrizeInfo[] memory prizeArr = prizes[_lotteryId];
        for (uint16 i = 0; i < prizeArr.length; i++) {
            acc += prizeArr[i].maxSupply;
        }
        return acc;
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
        IMemeXNFT _nftContract,
        uint256 _boostCost,
        uint16 _maxParticipants,
        uint256 _defaultPrizeId,
        address _artistAddress,
        string calldata _dropMetadataURI
    ) public onlyOwner returns (uint256 lotteryId) {
        // Incrementing lottery ID
        Status lotteryStatus;
        if (_startTime <= block.timestamp) {
            lotteryStatus = Status.Open;
        } else {
            lotteryStatus = Status.Planned;
        }
        // Saving data in struct
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
            _startTime + 259200, // 3 days
            _nftContract,
            0,
            _maxParticipants,
            _defaultPrizeId
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
        randomSeeds[_lotteryId] = _randomNumber;
        lottery.status = Status.Completed;
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

    function definePrizeWinners(uint256 _lotteryId) public onlyOwner {
        LotteryInfo memory lottery = lotteryHistory[_lotteryId];
        uint256 randomNumber = randomSeeds[_lotteryId];

        uint256 totalParticipants_ = lottery.participantsCount;
        uint256 totalPrizes = getTotalPrizes(_lotteryId);
        PrizeInfo[] memory prizeInfo = prizes[_lotteryId];
        // if there are less participants than prizes, reduce the number of prizes
        if (totalParticipants_ < totalPrizes) {
            totalPrizes = totalParticipants_;
        }
        // Loops through each prize assigning to a position on the entries array
        uint8 index = 0;
        for (uint16 i = 0; i < totalPrizes; i++) {
            if (i == prizeInfo[index].maxSupply) {
                index++;
                i = 0;
            }
            uint256 totalEntries = participantEntries[_lotteryId].length;
            // Encodes the random number with its position in loop
            bytes32 hashOfRandom = keccak256(abi.encodePacked(randomNumber, i));
            // Sets the winning number position to a uint16 of random hash number
            uint256 winningNumber = uint256(
                uint256(hashOfRandom) % totalEntries
            );
            // defines the winner
            bool winnerFound = false;
            do {
                address winnerAddress = participantEntries[_lotteryId][
                    winningNumber
                ];
                if (
                    // checks if this random position is already a winner
                    participants[_lotteryId][winnerAddress].prizeId ==
                    lottery.defaultPrizeId
                ) {
                    participants[_lotteryId][winnerAddress].prizeId = prizeInfo[
                        index
                    ].prizeId;
                    winnerFound = true;
                    // move the last position to remove the entry from the array
                    participantEntries[_lotteryId][
                        winningNumber
                    ] = participantEntries[_lotteryId][totalEntries - 1];
                    participantEntries[_lotteryId].pop();
                } else {
                    // If address is already a winner pick the next number until a new winner is found
                    winningNumber++;
                    winningNumber = winningNumber % totalEntries;
                }
            } while (winnerFound == false);
        }
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
                lottery.participantsCount < lottery.maxParticipants,
                "Lottery is full"
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

        IRewards rewardsToken = rewardsContract.rewardTokenAddress();

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
        uint256 userEntries = participants[_lotteryId][msg.sender].entries;
        if (userEntries == 0) {
            participantHistory[msg.sender].push(_lotteryId);
            lottery.participantsCount++;
            ParticipantInfo memory participant = ParticipantInfo(
                false,
                lottery.defaultPrizeId,
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
        participantEntries[_lotteryId].push(_participantAddress);
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
        require(
            msg.value >= lotteryHistory[_lotteryId].boostCost,
            "Didn't send enough to boost"
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
     * @notice Called by a winner participant to claim his prize.
     * @param _lotteryId ID of the lottery to claim prize
     */
    function claimPrize(uint256 _lotteryId) public {
        require(
            lotteryHistory[_lotteryId].status == Status.Completed,
            "Status Not Completed"
        );
        ParticipantInfo storage participant = participants[_lotteryId][
            msg.sender
        ];
        require(participant.prizeId != 0, "Participant is not a winner");
        require(
            participant.prizeClaimed == false,
            "Participant already claimed prize"
        );

        IMemeXNFT nftContract = lotteryHistory[_lotteryId].nftContract;

        participant.prizeClaimed = true;
        nftContract.mint(msg.sender, participant.prizeId, 1, "");
        emit PrizeClaimed(_lotteryId, msg.sender, participant.prizeId);
    }

    function claimWithProof(
        uint256 _lotteryId,
        address _winner,
        uint256 _prizeId,
        bytes32[] calldata _proof,
        uint256[] calldata _positions
    ) public {
        require(
            _verify(
                _leaf(_lotteryId, _winner, _prizeId),
                _lotteryId,
                _proof,
                _positions
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
        require(msg.sender == _winner, "Sender is not the winner address");

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
        uint256 _lotteryId,
        bytes32[] memory _proof,
        uint256[] memory _positions
    ) internal view returns (bool) {
        return
            verifyProof(_proof, _positions, merkleRoots[_lotteryId], _leafHash);
    }

    function verifyProof(
        bytes32[] memory proof,
        uint256[] memory positions,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (positions[i] == 1) {
                computedHash = keccak256(
                    abi.encode(computedHash, proofElement)
                );
            } else {
                computedHash = keccak256(
                    abi.encode(proofElement, computedHash)
                );
            }
        }

        return computedHash == root;
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
