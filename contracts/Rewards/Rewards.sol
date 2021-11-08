//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Access/MemeXAccessControls.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../../interfaces/IRewards.sol";

contract Rewards is MemeXAccessControls, IRewards {
    bytes32 public pointsMerkleRoot;

    mapping(address => uint256) public totalPointsUsed;

    mapping(address => uint256) public totalPointsEarned;

    event PointsUsed(address indexed user, uint256 amount, uint256 remaining);
    event PointsEarned(address indexed user, uint256 amount);

    constructor(address _admin) {
        initAccessControls(_admin);
    }

    function availablePoints(address user) public view returns (uint256) {
        return totalPointsEarned[user] - totalPointsUsed[user];
    }

    function burnUserPoints(address _account, uint256 _amount)
        public
        returns (uint256)
    {
        require(
            hasSmartContractRole(msg.sender),
            "Smart contract role required"
        );
        uint256 available = totalPointsEarned[_account] -
            totalPointsUsed[_account];
        require(_amount > 0, "Can't use 0 points");
        require(_amount <= available, "Not enough points");
        totalPointsUsed[_account] += _amount;

        emit PointsUsed(_account, _amount, available - _amount);
        return available - _amount;
    }

    function setPointsMerkleRoot(bytes32 _root) public {
        require(hasAdminRole(msg.sender), "Only Admin can set the merkle root");
        pointsMerkleRoot = _root;
    }

    function claimPointsWithProof(
        address _address,
        uint256 _points,
        bytes32[] calldata _proof
    ) public returns (uint256) {
        require(
            _verify(_leaf(_address, _points), pointsMerkleRoot, _proof),
            "Invalid proof"
        );
        uint256 newPoints = _points - totalPointsEarned[_address];
        require(newPoints > 0, "Participant already claimed all points");

        totalPointsEarned[_address] = _points;
        emit PointsEarned(_address, newPoints);
        return newPoints;
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
