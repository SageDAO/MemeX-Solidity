//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./IMemeXNFT.sol";

interface ILottery {
    function receiveRandomNumber(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) external;

    function createNewLottery(
        uint256 _collectionId,
        uint256 _costPerTicketPinas,
        uint256 _costPerTicketCoins,
        uint32 _startTime,
        uint32 _closeTime,
        IMemeXNFT _nftContract,
        bool _isRefundable,
        uint256 _defaultPrizeId
    ) external;
}
