pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "../../interfaces/ILottery.sol";

contract RandomNumberConsumer is Ownable, VRFConsumerBase {
    bytes32 internal keyHash;
    uint256 internal fee;
    uint256 public randomResult;
    address public lotteryAddr;
    address internal requester;
    uint256 public currentLotteryId;

    modifier onlyLottery() {
        require(msg.sender == lotteryAddr, "Lottery calls only");
        _;
    }

    /**
     * Network: Kovan
     * Chainlink VRF Coordinator address: 0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9
     * LINK token address:                0xa36085F69e2889c224210F603D836748e7dC0088
     * Key Hash: 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4
     */
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
     //SSS: No need for userProvidedSeed i think;
    function getRandomNumber(uint256 lotteryId, uint256 userProvidedSeed) 
                public returns  (bytes32 requestId) {
        require(
            LINK.balanceOf(address(this)) >= fee,
            "Not enough LINK - fill contract"
        ) ;
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
