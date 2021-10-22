//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Rewards is Ownable {
    address public lotteryAddr;

    bytes32 public merkleRoot;

    mapping(address => uint256) public pointsAvailable;

    mapping(address => uint256) public totalPointsClaimed;

    event PointsUsed(address indexed user, uint256 amount);
    event ClaimedReward(address indexed user, uint256 amount);

    modifier onlyLottery() {
        require(msg.sender == lotteryAddr, "Lottery calls only");
        _;
    }

    constructor() {}

    function setLotteryAddress(address _lotteryAddr) public onlyOwner {
        lotteryAddr = _lotteryAddr;
    }

    function burnUserPoints(address _account, uint256 _amount)
        public
        onlyLottery
    {
        require(_amount > 0, "Can't use 0 points");
        require(_amount <= pointsAvailable[_account], "Not enough points");
        pointsAvailable[_account] -= _amount;

        emit PointsUsed(_account, _amount);
    }

    function setMerkleRoot(bytes32 _root) public onlyOwner {
        merkleRoot = _root;
    }

    function claimRewardWithProof(
        address _address,
        uint256 _points,
        bytes32[] calldata _proof
    ) public returns (uint256) {
        require(
            _verify(_leaf(_address, _points), merkleRoot, _proof),
            "Invalid merkle proof"
        );
        require(
            totalPointsClaimed[_address] < _points,
            "Participant already claimed all points"
        );
        uint256 availablePoints = _points - totalPointsClaimed[_address];
        totalPointsClaimed[_address] = _points;
        pointsAvailable[_address] += availablePoints;
        emit ClaimedReward(_address, _points);
        return pointsAvailable[_address];
    }

    function _leaf(address _address, uint256 _points)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(_address, _points));
    }

    function _verify(
        bytes32 _leafHash,
        bytes32 _root,
        bytes32[] memory _proof
    ) internal pure returns (bool) {
        return MerkleProof.verify(_proof, _root, _leafHash);
    }
}
