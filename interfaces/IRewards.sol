//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewards {
    /**
     * Pina points earned by the player.
     */
    function burnUserPoints(address account, uint256 amount) external;

    function claimRewardWithProof(
        address _address,
        uint256 _points,
        bytes32[] calldata _proof
    ) external returns (uint256);
}
