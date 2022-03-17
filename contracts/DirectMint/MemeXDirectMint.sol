//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../Access/MemeXAccessControls.sol";

contract MemeXDirectMint is MemeXAccessControls {
    struct DirectMint {
        uint8 limitPerUser;
        uint16 totalTokensMinted;
        address erc20Token;
        IMemeXNFT nftContract;
        uint32 startTime;
        uint32 endTime;
        uint256 pricePerUnit;
        uint256 collectionId;
        uint256 nftIdRangeStart;
        uint256 nftIdRangeEnd;
    }

    event Minted(
        address indexed destination,
        uint256 indexed collectionId,
        uint256 indexed nftId
    );

    mapping(address => uint256) public userMints;

    mapping(uint256 => DirectMint) public directMints;

    constructor(address _admin) {
        initAccessControls(_admin);
    }

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(hasAdminRole(msg.sender), "Admin calls only");
        _;
    }

    function createDirectMint(
        uint8 limitPerUser,
        address erc20Token,
        IMemeXNFT nftContract,
        uint256 pricePerUnit,
        uint256 collectionId,
        uint32 startTime,
        uint32 endTime,
        uint256 nftIdRangeStart,
        uint256 nftIdRangeEnd
    ) public onlyAdmin {
        require(startTime < endTime, "Start time must be before end time");
        require(
            nftIdRangeStart <= nftIdRangeEnd,
            "NFT id range start must be before end"
        );

        DirectMint memory directMint = DirectMint(
            limitPerUser,
            0,
            erc20Token,
            nftContract,
            startTime,
            endTime,
            pricePerUnit,
            collectionId,
            nftIdRangeStart,
            nftIdRangeEnd
        );

        directMints[collectionId] = directMint;
    }

    function mintBatch(uint256 _collectionId, uint256 _amount) public payable {
        DirectMint storage dm = directMints[_collectionId];

        require(
            dm.nftContract.collectionExists(_collectionId),
            "Collection does not exist"
        );

        require(block.timestamp >= dm.startTime, "Minting has not started");
        require(block.timestamp < dm.endTime, "Minting has ended");

        userMints[msg.sender] += _amount;
        require(
            dm.limitPerUser <= userMints[msg.sender],
            "User has reached limit"
        );

        if (dm.erc20Token == address(0)) {
            require(
                msg.value >= dm.pricePerUnit * _amount,
                "Didn't transfer enough funds"
            );
        } else {
            IERC20(dm.erc20Token).transferFrom(
                msg.sender,
                address(this),
                dm.pricePerUnit * _amount
            );
        }

        for (uint256 i = 0; i < _amount; ++i) {
            uint256 tokenId = nextTokenId(_collectionId);
            dm.nftContract.mint(msg.sender, tokenId, 1, _collectionId, "");

            emit Minted(msg.sender, _collectionId, tokenId);
        }
    }

    function nextTokenId(uint256 _collectionId) internal returns (uint256) {
        DirectMint storage dm = directMints[_collectionId];
        uint256 tokenId = dm.nftIdRangeStart + dm.totalTokensMinted;
        ++dm.totalTokensMinted;
        return tokenId;
    }
}
