pragma solidity >=0.6.0;
import "./IMemeXNFT.sol";

//SPDX-License-Identifier: MIT

interface ILottery {
    //-------------------------------------------------------------------------
    // STATE MODIFYING FUNCTIONS
    //-------------------------------------------------------------------------

    function receiveRandomNumber(
        uint256 _lotteryId,
        bytes32 _requestId,
        uint256 _randomNumber
    ) external;

    function createNewLottery(
        uint256 _costPerTicketPinas,
        uint256 _costPerTicketCoins,
        uint256 _startingTime,
        uint256 _closingTime,
        IMemeXNFT _nftContract,
        uint256 _prizes,
        uint256 _boostCost,
        uint32 _maxParticipants,
        bool _hasDefaultPrize
    ) external returns (uint256 lotteryId);
}
