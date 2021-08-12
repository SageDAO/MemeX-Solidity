pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "../../interfaces/ILottery.sol";

contract RandomNumberConsumer is Ownable, VRFConsumerBase {
    bytes32 internal keyHash;
    uint256 internal fee;
    uint256 public randomResult;
    address internal lotteryAddr;
    address internal requester;
    uint256 public currentLotteryId;

    modifier onlyLottery() {
        require(msg.sender == lotteryAddr, "Lottery calls only");
        _;
    }

    constructor(
        address _vrfCoordinator,
        address _linkToken,
        address _lotteryAddr,
        bytes32 _keyHash,
        uint256 _fee
    ) public VRFConsumerBase(_vrfCoordinator, _linkToken) {
        keyHash = _keyHash;
        fee = _fee;
        lotteryAddr = _lotteryAddr;
    }

    /**
     * Requests randomness
     */
    function getRandomNumber(uint256 lotteryId, uint256 userProvidedSeed)
        public
        onlyLottery
        returns (bytes32 requestId)
    {
        require(
            LINK.balanceOf(address(this)) >= fee,
            "Not enough LINK - fill contract"
        );
        requester = msg.sender;
        currentLotteryId = lotteryId;
        return requestRandomness(keyHash, fee);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness)
        internal
        override
    {
        ILottery(requester).numbersDrawn(
            currentLotteryId,
            requestId,
            randomness
        );
        randomResult = randomness;
    }

    /**
     * Function to allow removing LINK from the contract
     */
    function withdrawLink(uint256 ammount) external onlyOwner {
        LINK.transfer(msg.sender, ammount);
    }
}
