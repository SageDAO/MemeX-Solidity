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
        uint256 _lotteryId,
        uint256 _costPerTicketPinas,
        uint256 _costPerTicketCoins,
        uint32 _startTime,
        uint32 _closeTime,
        IMemeXNFT _nftContract,
        uint16 _maxParticipants,
        address _artistAddress,
        uint256 _defaultPrizeId,
        uint16 _royaltyPercentage,
        string calldata _dropMetadataURI
    ) external returns (uint256 lotteryId);
}
