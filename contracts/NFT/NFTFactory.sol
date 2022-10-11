//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SageNFT.sol";
import "../../interfaces/ISageStorage.sol";

error PermissionDenied();

contract NFTFactory {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    mapping(address => SageNFT) artistContracts;
    ISageStorage immutable sageStorage;

    event NewNFTContract(
        address indexed contractAddress,
        address indexed artistAddress
    );

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(
            sageStorage.hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Admin calls only"
        );
        _;
    }

    modifier onlyArtist() {
        require(
            sageStorage.hasRole(sageStorage.ARTIST_ROLE(), msg.sender),
            "Artist calls only"
        );
        _;
    }

    constructor(address _sageStorage) {
        sageStorage = ISageStorage(_sageStorage);
    }

    function getTreasuryAddress() public view returns (address) {
        return sageStorage.getAddress(keccak256("address.treasury"));
    }

    function createNFTContract(
        address artistAddress,
        string calldata name,
        string calldata symbol
    ) internal returns (SageNFT) {
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
        sageStorage.setBool(
            keccak256(
                abi.encodePacked("market.contract_wl", address(newContract))
            ),
            true
        );
        emit NewNFTContract(address(newContract), artistAddress);
        return newContract;
    }

    function deployByAdmin(
        address artistAddress,
        string calldata name,
        string calldata symbol
    ) public onlyAdmin {
        createNFTContract(artistAddress, name, symbol);
    }

    function deployByArtist(string calldata name, string calldata symbol)
        public
        onlyArtist
    {
        SageNFT newContract = createNFTContract(msg.sender, name, symbol);
        newContract.transferOwnership(getTreasuryAddress());
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
        onlyAdmin
    {
        sageStorage.setBool(
            keccak256(
                abi.encodePacked("market.contract_wl", address(contractAddress))
            ),
            false
        );
    }
}
