pragma solidity >=0.6.0;

//SPDX-License-Identifier: MIT

interface INFT {
    function safeMint(
        address _to,
        uint256 _id,
        string memory _uri
    ) external;

    function owner() external view returns (address);
}
