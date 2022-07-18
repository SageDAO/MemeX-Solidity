//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SageNFT.sol";
import "../../interfaces/ISageStorage.sol";

contract NFTFactory {
    mapping(address => SageNFT) artistContracts;
    ISageStorage sageStorage = ISageStorage(address(0));

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(
            sageStorage.getBool(
                keccak256(abi.encodePacked("role.admin", msg.sender))
            ),
            "Admin calls only"
        );
        _;
    }

    constructor(address _sageStorage) {
        sageStorage = ISageStorage(_sageStorage);
    }

    function createNFTContract(
        address artistAddress,
        string calldata name,
        string calldata symbol
    ) public onlyAdmin {
        require(
            address(artistContracts[artistAddress]) == address(0),
            "Contract already exists"
        );
        SageNFT newContract = new SageNFT(
            name,
            symbol,
            address(sageStorage),
            artistAddress
        );
        artistContracts[artistAddress] = newContract;
    }

    function getContractAddress(address artistAddress)
        public
        view
        returns (address)
    {
        return address(artistContracts[artistAddress]);
    }
}
