pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface ILottery {
    //-------------------------------------------------------------------------
    // STATE MODIFYING FUNCTIONS
    //-------------------------------------------------------------------------

    function numbersDrawn(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) external;
}
