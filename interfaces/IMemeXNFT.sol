pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface IMemeXNFT {
    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes calldata _data,
        uint256 _lotteryId
    ) external;
}
