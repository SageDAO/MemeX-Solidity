pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface IMemeXNFT {
    function mint(
        address _to,
        uint256 _id,
        uint32 _quantity,
        uint256 _collectionId,
        bytes calldata _data
    ) external;

    function createCollection(
        address _artistAddress,
        uint16 _royaltyPercentage,
        string memory _dropMetadataURI,
        address _primarySalesDestination
    ) external returns (uint256);

    function setCollectionBaseMetadataURI(
        uint256 _collectionId,
        string memory _newBaseMetadataURI
    ) external;

    function getCollectionInfo(uint256 _collectionId)
        external
        returns (
            address,
            uint16,
            string memory,
            address
        );

    function collectionExists(uint256 _collectionId) external returns (bool);
}
