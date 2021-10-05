pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface IMemeXNFT {
    function safeMint(address _to, uint256 _id) external;

    function setBaseMetadataURI(string memory _newBaseMetadataURI) external;

    function ownerOf(uint256 _id) external view returns (address);
}
