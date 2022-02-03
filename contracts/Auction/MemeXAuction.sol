//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../Access/MemeXAccessControls.sol";

contract MemeXAuction is MemeXAccessControls {
    uint256 public auctionCount;

    mapping(uint256 => Auction) public auctions;

    address public feeBeneficiary;

    uint16 public defaultTimeExtension = 3600;
    uint16 public bidIncrementPercentage = 100; // 1,00% higher than the previous bid

    struct Auction {
        uint256 endTime;
        uint256 collectionId;
        uint256 nftId;
        // seller can define an ERC20 token to be used for the auction.
        // If not defined, the native token is used (FTM).
        address erc20Token;
        uint256 buyNowPrice;
        uint256 minimumPrice;
        uint256 highestBid;
        address highestBidder;
        IMemeXNFT nftContract;
        uint16 feePercentage;
        bool finished;
    }

    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed collectionId,
        uint256 nftId,
        address erc20Token
    );

    event AuctionCancelled(uint256 auctionId);

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed highestBidderIdx,
        address highestBidder,
        uint256 highestBid
    );

    event BidPlaced(
        uint256 indexed auctionIdIdx,
        uint256 auctionId,
        address indexed bidderIdx,
        address bidder,
        uint256 bidAmount,
        uint256 newEndTime
    );

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(hasAdminRole(msg.sender), "Admin calls only");
        _;
    }

    constructor(address _admin) {
        initAccessControls(_admin);
        setFeeBeneficiary(_admin);
    }

    function incrementAuctionCount() internal returns (uint256) {
        auctionCount++;
        return auctionCount;
    }

    function setDefaultTimeExtension(uint16 _timeExtension) public onlyAdmin {
        defaultTimeExtension = _timeExtension;
    }

    function setBidIncrementPercentage(uint16 _bidIncrementPercentage)
        public
        onlyAdmin
    {
        bidIncrementPercentage = _bidIncrementPercentage;
    }

    function setFeeBeneficiary(address _feeBeneficiary) public onlyAdmin {
        feeBeneficiary = _feeBeneficiary;
    }

    function createCollectionAndAuction(
        uint256 _nftId,
        uint256 _buyNowPrice,
        uint256 _minimumPrice,
        address _token,
        uint32 _duration,
        IMemeXNFT _nftContract,
        uint16 _fee,
        address _artistAddress,
        uint16 _royaltyPercentage,
        string calldata _metadataURI
    ) public onlyAdmin returns (uint256 auctionId) {
        uint256 collectionId = _nftContract.createCollection(
            _artistAddress,
            _royaltyPercentage,
            _metadataURI
        );
        require(collectionId > 0, "Collection creation failed");
        return
            createAuction(
                collectionId,
                _nftId,
                _buyNowPrice,
                _minimumPrice,
                _token,
                _duration,
                _nftContract,
                _fee
            );
    }

    function createAuction(
        uint256 _collectionId,
        uint256 _nftId,
        uint256 _buyNowPrice,
        uint256 _minimumPrice,
        address _token,
        uint32 _duration,
        IMemeXNFT _nftContract,
        uint16 _fee
    ) public onlyAdmin returns (uint256 auctionId) {
        require(_duration > 0, "Invalid auction time");
        require(
            _buyNowPrice == 0 || _buyNowPrice >= _minimumPrice,
            "Invalid buy now price"
        );
        require(
            _nftContract.collectionExists(_collectionId),
            "Collection does not exist"
        );

        auctionId = incrementAuctionCount();

        Auction memory auction = Auction(
            block.timestamp + _duration,
            _collectionId,
            _nftId,
            _token,
            _buyNowPrice,
            _minimumPrice,
            0,
            address(0),
            _nftContract,
            _fee,
            false
        );

        auctions[auctionId] = auction;

        emit AuctionCreated(auctionId, _collectionId, _nftId, _token);

        return auctionId;
    }

    function settleAuction(uint256 _auctionId) public {
        Auction storage auction = auctions[_auctionId];
        require(!auction.finished, "Auction is already finished");
        uint256 highestBid = auction.highestBid;
        address highestBidder = auction.highestBidder;
        require(
            block.timestamp > auction.endTime ||
                auction.highestBid == auction.buyNowPrice,
            "Auction is still running"
        );

        auction.finished = true;
        if (highestBidder != address(0)) {
            auction.nftContract.mint(
                highestBidder,
                auction.nftId,
                1,
                auction.collectionId,
                ""
            );
        }

        (address artistAddress, , ) = auction.nftContract.getCollectionInfo(
            auction.collectionId
        );

        uint256 feePaid = getPercentageOfBid(highestBid, auction.feePercentage);
        if (acceptsERC20(_auctionId)) {
            if (feePaid != 0) {
                IERC20(auction.erc20Token).transfer(feeBeneficiary, feePaid);
            }
            IERC20(auction.erc20Token).transfer(
                artistAddress,
                highestBid - feePaid
            );
        } else {
            if (feePaid != 0) {
                (bool feeSent, ) = feeBeneficiary.call{value: feePaid}("");
                require(feeSent, "Failed to send FTM to fee beneficiary");
            }
            (bool sent, ) = artistAddress.call{value: highestBid - feePaid}("");
            require(sent, "Failed to send FTM to artist");
        }

        emit AuctionSettled(
            _auctionId,
            auction.highestBidder,
            auction.highestBidder,
            auction.highestBid
        );
    }

    function getPercentageOfBid(uint256 _bid, uint256 _percentage)
        internal
        pure
        returns (uint256)
    {
        return (_bid * (_percentage)) / 10000;
    }

    function updateAuction(
        uint256 _auctionId,
        uint256 _buyNowPrice,
        uint256 _minimumPrice,
        address _token,
        uint64 _endTime
    ) public onlyAdmin {
        require(!auctions[_auctionId].finished, "Auction is already finished");
        require(auctions[_auctionId].endTime > 0, "Auction not found");
        Auction storage auction = auctions[_auctionId];
        auction.buyNowPrice = _buyNowPrice;
        auction.minimumPrice = _minimumPrice;
        auction.erc20Token = _token;
        auction.endTime = _endTime;
    }

    function cancelAuction(uint256 _auctionId) public onlyAdmin {
        require(!auctions[_auctionId].finished, "Auction is already finished");
        reverseLastBid(_auctionId);
        auctions[_auctionId].finished = true;
        emit AuctionCancelled(_auctionId);
    }

    function bid(uint256 _auctionId, uint256 _amount) public payable {
        Auction storage auction = auctions[_auctionId];
        require(!auction.finished, "Auction is already finished");
        uint256 endTime = auction.endTime;
        require(endTime > block.timestamp, "Auction has ended");
        require(
            _amount > 0 && _amount >= auction.minimumPrice,
            "Bid is lower than minimum"
        );
        require(
            auction.buyNowPrice == 0 || _amount <= auction.buyNowPrice,
            "Bid higher than buy now price"
        );
        require(
            _amount == auction.buyNowPrice ||
                _amount >=
                (auction.highestBid * (10000 + bidIncrementPercentage)) / 10000,
            "Bid is lower than highest bid increment"
        );

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

        uint16 timeExtension = defaultTimeExtension;

        if (endTime - block.timestamp < timeExtension) {
            endTime = block.timestamp + timeExtension;
            auction.endTime = endTime;
        }

        if (auction.buyNowPrice != 0 && _amount == auction.buyNowPrice) {
            settleAuction(_auctionId);
        }
        emit BidPlaced(
            _auctionId,
            _auctionId,
            msg.sender,
            msg.sender,
            _amount,
            endTime
        );
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
                require(sent, "Failed to reverse bid");
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
