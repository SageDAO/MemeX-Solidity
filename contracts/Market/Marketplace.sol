//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/INFT.sol";
import "../../interfaces/ISageStorage.sol";

contract Marketplace {
    // contract address => tokenId => buy offer array
    mapping(address => mapping(uint256 => Offer[])) buyOffers;

    // contract address => tokenId => current sell offer
    mapping(address => mapping(uint256 => Offer)) sellOffers;

    IERC20 public token;
    ISageStorage immutable sageStorage;

    struct Offer {
        address from;
        uint32 expiresAt;
        uint256 priceOffer;
    }

    event NewBuyOffer(
        address indexed from,
        address indexed contractAddress,
        uint256 tokenId,
        uint256 priceOffer
    );

    event ListedNFTSold(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price
    );

    constructor(address _storage) {
        sageStorage = ISageStorage(_storage);
    }

    function createBuyOffer(
        address contractAddress,
        uint256 tokenId,
        uint256 _priceOffer,
        uint32 expiresAt
    ) public {
        Offer memory offer = Offer(msg.sender, expiresAt, _priceOffer);
        buyOffers[contractAddress][tokenId].push(offer);
        emit NewBuyOffer(msg.sender, contractAddress, tokenId, _priceOffer);
    }

    function getBuyOffer(
        address contractAddress,
        uint256 tokenId,
        uint256 index
    )
        public
        view
        returns (
            address,
            uint32,
            uint256
        )
    {
        Offer memory offer = buyOffers[contractAddress][tokenId][index];
        return (offer.from, offer.expiresAt, offer.priceOffer);
    }

    function acceptBuyOffer(
        address contractAddress,
        uint256 tokenId,
        uint256 index
    ) public {
        require(
            IERC721(contractAddress).ownerOf(tokenId) == msg.sender,
            "Only owner can accept offer"
        );
        Offer storage offer = buyOffers[contractAddress][tokenId][index];
        token.transferFrom(offer.from, msg.sender, offer.priceOffer); // TODO market cut
        IERC721 nftContract = IERC721(contractAddress);
        emit ListedNFTSold(offer.from, tokenId, offer.priceOffer);
        nftContract.safeTransferFrom(msg.sender, offer.from, tokenId, "");
        offer.priceOffer = 0;
    }

    function createSellOffer(
        address contractAddress,
        uint256 tokenId,
        uint256 price
    ) public {
        address owner = IERC721(contractAddress).ownerOf(tokenId);
        require(owner == msg.sender, "Only owner can create sell offers");

        Offer storage sellOffer = sellOffers[contractAddress][tokenId];

        sellOffer.priceOffer = price;
        sellOffer.from = msg.sender;
    }

    function takeSellOffer(address contractAddress, uint256 tokenId) public {
        Offer storage sellOffer = sellOffers[contractAddress][tokenId];
        IERC721 nftContract = IERC721(contractAddress);
        nftContract.safeTransferFrom(sellOffer.from, msg.sender, tokenId, "");
        token.transferFrom(msg.sender, sellOffer.from, sellOffer.priceOffer); // TODO market cut
        emit ListedNFTSold(msg.sender, tokenId, sellOffer.priceOffer);
        sellOffer.from = address(0);
        sellOffer.priceOffer = 0;
    }
}
