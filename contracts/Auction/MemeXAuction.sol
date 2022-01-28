//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../Access/MemeXAccessControls.sol";
import "../Utils/StringUtils.sol";

contract MemeXAuction is MemeXAccessControls {
    mapping(uint256 => Auction) public auctions;

    IMemeXNFT nftContract;

    address feeBeneficiary;

    struct Auction {
        address artist;
        // seller can define an ERC20 token to be used for the auction.
        // If not defined, the native token is used (FTM).
        address erc20Token;
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

    event AuctionCancelled(uint256 auctionId);

    event BidPlaced(uint256 auctionId, address bidder, uint256 bidAmount);

    constructor(address _nftContract, address _admin) {
        initAccessControls(_admin);
        nftContract = IMemeXNFT(_nftContract);
    }

    function create(
        address _artistAddress,
        uint256 _buyNowPrice,
        uint256 _minimumPrice,
        address _token,
        uint64 _startTime,
        uint64 _endTime,
        uint16 _royaltyPercentage,
        string calldata _metadataURI
    ) public returns (uint256 auctionId) {
        require(hasAdminRole(msg.sender), "Only admins can create auctions");
        require(_buyNowPrice >= _minimumPrice);
        require(_startTime < _endTime);

        auctionId = nftContract.createCollection(
            _artistAddress,
            _royaltyPercentage,
            _metadataURI
        );
        require(auctionId > 0, "Failed to create a collection");

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

        auctions[auctionId] = auction;

        emit AuctionCreated(
            _artistAddress,
            _buyNowPrice,
            _minimumPrice,
            _startTime,
            _endTime
        );

        return auctionId;
    }

    function cancelAuction(uint256 _auctionId) public returns (bool success) {
        require(hasAdminRole(msg.sender), "Only admins can cancel auctions");
        require(!auctions[_auctionId].finished, "Auction is already finished");
        reverseLastBid(_auctionId);
        auctions[_auctionId].finished = true;
        emit AuctionCancelled(_auctionId);
        return true;
    }

    function bid(uint256 _auctionId, uint256 _amount) public payable {
        Auction storage auction = auctions[_auctionId];
        require(
            auction.startTime <= block.timestamp,
            "Auction has not started yet"
        );
        require(auction.endTime > block.timestamp, "Auction has ended");
        require(auction.minimumPrice <= _amount, "Bid is lower than minimum");
        require(
            auction.buyNowPrice != 0 && _amount <= auction.buyNowPrice,
            "Bid higher than buy now price"
        );
        require(_amount > auction.highestBid, "Bid is lower than highest bid");

        if (acceptsERC20(_auctionId)) {
            require(msg.value == 0, "Auction is receiving ERC20 tokens");
            IERC20(auction.erc20Token).transferFrom(
                msg.sender,
                address(this),
                _amount
            );
        } else {
            require(msg.value == _amount, "Value != bid amount");
        }
        reverseLastBid(_auctionId);
        auction.highestBidder = msg.sender;
        auction.highestBid = _amount;
        emit BidPlaced(_auctionId, msg.sender, _amount);
    }

    function reverseLastBid(uint256 _auctionId) private {
        Auction storage auction = auctions[_auctionId];
        address highestBidder = auction.highestBidder;
        uint256 highestBid = auction.highestBid;
        auction.highestBidder = address(0);
        auction.highestBid = 0;

        if (highestBidder != address(0)) {
            if (acceptsERC20(_auctionId)) {
                IERC20(auction.erc20Token).transfer(highestBidder, highestBid);
            } else {
                (bool sent, ) = highestBidder.call{value: highestBid}("");
                require(sent, "Failed to send Ether");
            }
        }
    }

    function getAuction(uint256 _auctionId)
        public
        view
        returns (Auction memory)
    {
        return auctions[_auctionId];
    }

    function acceptsERC20(uint256 _auctionId) public view returns (bool) {
        return auctions[_auctionId].erc20Token != address(0);
    }
}
