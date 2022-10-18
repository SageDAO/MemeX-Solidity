//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SageNFT.sol";
import "../../interfaces/ISageStorage.sol";

error PermissionDenied();

contract NFTFactory {
    bytes32 public constant ADMIN_ROLE = keccak256("role.admin");
    bytes32 public constant ARTIST_ROLE = keccak256("role.artist");
    address public constant TREASURY_ADDRESS =
        0x7AF3bA4A5854438a6BF27E4d005cD07d5497C33E;

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
            sageStorage.hasRole(ADMIN_ROLE, msg.sender),
            "Admin calls only"
        );
        _;
    }

    modifier onlyMultisig() {
        require(sageStorage.hasRole(0x00, msg.sender), "Admin calls only");
        _;
    }

    modifier onlyArtist() {
        require(
            sageStorage.hasRole(ARTIST_ROLE, msg.sender),
            "Artist calls only"
        );
        _;
    }

    constructor(address _sageStorage) {
        sageStorage = ISageStorage(_sageStorage);
    }

    function getTreasuryAddress() public pure returns (address) {
        return TREASURY_ADDRESS;
    }

    function resetArtistContract(address _artist) public onlyMultisig {
        artistContracts[_artist] = SageNFT(payable(address(0)));
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
}
