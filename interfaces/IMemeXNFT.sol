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

    function initNFT(
        string memory _name,
        string memory _symbol,
        address _admin
        ) external;

    function setBaseMetadataURI(string memory _newBaseMetadataURI) external;
    
    function create(
        address _initialOwner,
        uint256 _id,
        uint256 _initialSupply,
        uint256 _maxSupply,
        bytes calldata _data,
        uint256 _lotteryId
    ) external returns (uint256);
}
