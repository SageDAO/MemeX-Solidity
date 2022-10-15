//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/INFT.sol";
import "../../interfaces/ISageStorage.sol";

contract Auction is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    IERC20 public erc20;
    ISageStorage private sageStorage;

    mapping(uint256 => AuctionInfo) public auctions;

    uint256 public constant DEFAULT_EXTENSION = 600;
    uint256 private constant bidIncrementPercentage = 100; // 1,00% higher than the previous bid

    struct AuctionInfo {
        address highestBidder;
        INFT nftContract;
        uint32 startTime;
        uint32 endTime;
        uint32 duration;
        bool settled;
        uint256 minimumPrice;
        uint256 highestBid;
        uint256 auctionId;
        string nftUri;
    }

    event AuctionCreated(uint256 auctionId, address nftContract);

    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed previousBidder
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed highestBidder,
        uint256 highestBid
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed newBidder,
        address indexed previousBidder,
        uint256 bidAmount,
        uint256 newEndTime
    );

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(sageStorage.hasRole(0x00, msg.sender), "Admin calls only");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Constructor for an upgradable contract
     */
    function initialize(
        address _admin,
        address _token,
        address _storage
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        erc20 = IERC20(_token);
        sageStorage = ISageStorage(_storage);
    }

    function createAuction(AuctionInfo calldata _auctionInfo) public onlyAdmin {
        require(
            _auctionInfo.endTime == 0 ||
                _auctionInfo.endTime > _auctionInfo.startTime,
            "Invalid auction time"
        );
        require(
            auctions[_auctionInfo.auctionId].startTime == 0,
            "Auction already exists"
        );
        auctions[_auctionInfo.auctionId] = _auctionInfo;

        emit AuctionCreated(
            _auctionInfo.auctionId,
            address(_auctionInfo.nftContract)
        );
    }

    function createAuctionBatch(AuctionInfo[] calldata _auctions)
        public
        onlyAdmin
    {
        uint256 length = _auctions.length;
        for (uint256 i = 0; i < length; ++i) {
            createAuction(_auctions[i]);
        }
    }

    function settleAuction(uint256 _auctionId) public whenNotPaused {
        AuctionInfo storage auction = auctions[_auctionId];
        require(!auction.settled, "Auction already settled");
        uint256 highestBid = auction.highestBid;
        address highestBidder = auction.highestBidder;
        uint256 endTime = auction.endTime;
        require(
            endTime > 0 && block.timestamp > endTime,
            "Auction is still running"
        );

        auction.settled = true;
        if (highestBidder != address(0)) {
            auction.nftContract.safeMint(highestBidder, auction.nftUri);

            erc20.transfer(address(auction.nftContract), highestBid);
        }

        emit AuctionSettled(_auctionId, highestBidder, highestBid);
    }

    function getPercentageOfBid(uint256 _bid, uint256 _percentage)
        internal
        pure
        returns (uint256)
    {
        return (_bid * _percentage) / 10000;
    }

    function updateAuction(
        uint256 _auctionId,
        uint256 _minimumPrice,
        uint32 _endTime
    ) public onlyAdmin {
        require(!auctions[_auctionId].settled, "Auction already settled");
        require(auctions[_auctionId].startTime > 0, "Auction not found");
        AuctionInfo storage auction = auctions[_auctionId];
        auction.minimumPrice = _minimumPrice;
        auction.endTime = _endTime;
    }

    function cancelAuction(uint256 _auctionId) public onlyAdmin {
        AuctionInfo storage auction = auctions[_auctionId];
        require(!auction.settled, "Auction is already finished");
        address previousBidder = auction.highestBidder;
        uint256 previousBid = auction.highestBid;
        auction.highestBidder = address(0);
        auction.highestBid = 0;

        if (previousBidder != address(0)) {
            erc20.transfer(previousBidder, previousBid);
        }
        auctions[_auctionId].settled = true;
        emit AuctionCancelled(_auctionId, previousBidder);
    }

    function bid(uint256 _auctionId, uint256 _amount)
        public
        nonReentrant
        whenNotPaused
    {
        AuctionInfo storage auction = auctions[_auctionId];
        uint256 endTime = auction.endTime;
        uint256 startTime = auction.startTime;
        uint256 timestamp = block.timestamp;
        require(startTime > 0, "Auction doesn't exist");
        require(timestamp >= startTime, "Auction not available");
        require(endTime == 0 || endTime > timestamp, "Auction has ended");
        require(!auction.settled, "Auction already settled");
        require(
            _amount > 0 && _amount >= auction.minimumPrice,
            "Bid is lower than minimum"
        );

        require(
            _amount >=
                (auction.highestBid * (10000 + bidIncrementPercentage)) / 10000,
            "Bid is lower than highest bid increment"
        );
        erc20.transferFrom(msg.sender, address(this), _amount);

        // revert previous bid
        address previousBidder = auction.highestBidder;
        uint256 previousBid = auction.highestBid;
        auction.highestBidder = msg.sender;
        auction.highestBid = _amount;

        if (previousBidder != address(0)) {
            erc20.transfer(previousBidder, previousBid);
        }

        if (endTime == 0) {
            auction.endTime = uint32(timestamp + auction.duration);
        } else {
            if (endTime - timestamp < DEFAULT_EXTENSION) {
                endTime = timestamp + DEFAULT_EXTENSION;
                auction.endTime = uint32(endTime);
            }
        }

        emit BidPlaced(
            _auctionId,
            msg.sender,
            previousBidder,
            _amount,
            endTime
        );
    }

    function getAuction(uint256 _auctionId)
        public
        view
        returns (AuctionInfo memory)
    {
        return auctions[_auctionId];
    }

    function getBidIncrementPercentage() public view returns (uint256) {
        return bidIncrementPercentage;
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyAdmin
    {}
}
