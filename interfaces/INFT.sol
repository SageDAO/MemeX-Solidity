pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface INFT {
    function safeMint(
        address _to,
        uint256 _id,
        uint256 _collectionId
    ) external;

    function createCollection(
        uint256 _collectionId,
        address _artistAddress,
        uint16 _royaltyPercentage,
        string memory _dropMetadataURI,
        address _primarySalesDestination
    ) external;

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
