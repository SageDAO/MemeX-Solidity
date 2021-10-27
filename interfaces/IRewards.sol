//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewards {
    /**
     * Pina points earned by the player.
     */
    function burnUserPoints(address account, uint256 amount)
        external
        returns (uint256);

    function pointsAvailable(address _user) external view returns (uint256);
}
