//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SageNFT.sol";
import "../../interfaces/ISageStorage.sol";

error PermissionDenied();

contract NFTFactory {
    mapping(address => SageNFT) artistContracts;
    ISageStorage sageStorage = ISageStorage(address(0));

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyRole(string memory role) {
        if (
            !sageStorage.getBool(keccak256(abi.encodePacked(role, msg.sender)))
        ) {
            revert PermissionDenied();
        }
        _;
    }

    constructor(address _sageStorage) {
        sageStorage = ISageStorage(_sageStorage);
    }

    function createNFTContract(
        address artistAddress,
        string calldata name,
        string calldata symbol
    ) public onlyRole("role.admin") {
        require(
            address(artistContracts[artistAddress]) == address(0),
            "Contract already exists"
        );
        SageNFT newContract = new SageNFT(name, symbol, address(sageStorage));
        newContract.transferOwnership(artistAddress);
        artistContracts[artistAddress] = newContract;
    }

    function deployOwnContract(string calldata name, string calldata symbol)
        public
        onlyRole("role.creator")
    {
        createNFTContract(msg.sender, name, symbol);
    }

    function getContractAddress(address artistAddress)
        public
        view
        returns (address)
    {
        return address(artistContracts[artistAddress]);
    }
}
