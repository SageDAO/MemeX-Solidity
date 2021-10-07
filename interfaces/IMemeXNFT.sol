pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface IMemeXNFT {
    function mint(
        address _to,
        uint256 _id,
        bytes calldata _data
    ) external;

    function create(
        uint256 _id,
        uint32 _maxSupply,
        uint256 _lotteryId,
        address _artistAddress
    ) external;

    function setBaseMetadataURI(string memory _newBaseMetadataURI) external;

    function ownerOf(uint256 _id) external view returns (address);
}
