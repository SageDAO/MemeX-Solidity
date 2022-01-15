//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../Access/MemeXAccessControls.sol";

contract MemeXAuction is MemeXAccessControls {
    mapping(uint256 => Auction) public auctions;

    IMemeXNFT nftContract;

    address feeBeneficiary;

    struct Auction {
        address artist;
        // seller can define an ERC20 token to be used for the auction.
        // If not defined, the native token is used (FTM).
        IERC20 token;
        uint256 buyNowPrice;
        uint256 minimumPrice;
        uint256 highestBid;
        address highestBidder;
        uint64 startTime;
        uint64 endTime;
        bool finished;
    }

    event AuctionCreated(
        address artist,
        uint256 buyNowPrice,
        uint256 minimumPrice,
        uint64 startTime,
        uint64 endTime
    );

    constructor(address _nftContract) {
        nftContract = IMemeXNFT(_nftContract);
    }

    function create(
        address _artistAddress,
        uint256 _auctionId,
        uint256 _buyNowPrice,
        uint256 _minimumPrice,
        IERC20 _token,
        uint64 _startTime,
        uint64 _endTime,
        uint16 _royaltyPercentage,
        string calldata _metadataURI
    ) public returns (uint256 auctionId) {
        require(_buyNowPrice >= _minimumPrice);
        require(_startTime < _endTime);

        if (_auctionId == 0) {
            auctionId = nftContract.createCollection(
                _artistAddress,
                _royaltyPercentage,
                _metadataURI
            );
        }

        require(_auctionId > 0, "Failed to create a collection");

        Auction memory auction = Auction(
            _artistAddress,
            _token,
            _buyNowPrice,
            _minimumPrice,
            0,
            address(0),
            _startTime,
            _endTime,
            false
        );

        auctions[_auctionId] = auction;

        emit AuctionCreated(
            _artistAddress,
            _buyNowPrice,
            _minimumPrice,
            _startTime,
            _endTime
        );
    }

    function bid(uint256 _auctionId, uint256 value) public {
        Auction memory auction = auctions[_auctionId];

        require(
            auction.minimumPrice <= value &&
                value <= auction.buyNowPrice &&
                auction.startTime <= block.timestamp &&
                block.timestamp <= auction.endTime
        );
    }

    function acceptsERC20(uint256 _auctionId) public view returns (bool) {
        return address(auctions[_auctionId].token) != address(0);
    }
}
