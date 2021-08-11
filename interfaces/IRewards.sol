//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewards {
    /**
     * Points earned by the player.
     */
    function earned(address account, uint256 pool) external returns (uint256);

    function isLiquidityProvider(address account) external returns (bool);
}
