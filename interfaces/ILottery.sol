//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./IMemeXNFT.sol";

interface ILottery {
    function receiveRandomNumber(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) external;
}
