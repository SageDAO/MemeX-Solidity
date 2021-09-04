//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewards {
    /**
     * Pinas earned by the player.
     */
    function balanceOf(address account) external view returns (uint256);

    function burnPinas(address account, uint256 amount) external;

    function mintPinas(address recipient, uint256 amount) external;
}
