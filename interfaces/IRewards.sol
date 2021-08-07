//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewards {
    /**
     * Requests randomness for a given lottery id
     */
    function earned(address account, uint256 pool)
        external
        returns (uint256);
}
