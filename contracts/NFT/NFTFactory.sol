//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SageNFT.sol";
import "../../interfaces/ISageStorage.sol";

error PermissionDenied();

contract NFTFactory {
    mapping(address => SageNFT) artistContracts;
    ISageStorage immutable sageStorage;

    event NewNFTContract(
        address indexed contractAddress,
        address indexed artistAddress
    );

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
    ) internal {
        require(
            address(artistContracts[artistAddress]) == address(0),
            "Contract already exists"
        );
        SageNFT newContract = new SageNFT(name, symbol, address(sageStorage));
        newContract.transferOwnership(artistAddress);
        artistContracts[artistAddress] = newContract;
        sageStorage.setBool(
            keccak256(
                abi.encodePacked("market.contract_wl", address(newContract))
            ),
            true
        );

        emit NewNFTContract(address(newContract), artistAddress);
    }

    function deployByAdmin(
        address artistAddress,
        string calldata name,
        string calldata symbol
    ) public onlyRole("role.admin") {
        createNFTContract(artistAddress, name, symbol);
    }

    function deployByArtist(string calldata name, string calldata symbol)
        public
        onlyRole("role.artist")
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

    function removeWhitelistedContract(address contractAddress)
        public
        onlyRole("role.admin")
    {
        sageStorage.setBool(
            keccak256(
                abi.encodePacked("market.contract_wl", address(contractAddress))
            ),
            false
        );
    }
}
