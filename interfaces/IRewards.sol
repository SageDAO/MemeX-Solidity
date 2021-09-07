//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewards {
    /**
     * Pina points earned by the player.
     */
    function earned(address account, uint256 pool) external returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function burnPinas(address account, uint256 amount) external;

    function mintPinas(address recipient, uint256 amount) external;

    function getPoolRewardToken(uint256 id) external view returns (IRewards);
}
