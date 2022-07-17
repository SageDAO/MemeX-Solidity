//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Marketplace {
    // contract address => tokenId => offer
    mapping(address => mapping(uint256 => BuyOffer)) buyOffers;

    IERC20 public token;

    struct BuyOffer {
        address from;
        uint256 amount;
    }

    event NewBuyOffer(
        address indexed from,
        address indexed contractAddress,
        uint256 tokenId,
        uint256 amount
    );

    event BuyOfferAccepted();

    function createBuyOffer(
        address contractAddress,
        uint256 tokenId,
        uint256 amount
    ) public {
        BuyOffer storage offer = buyOffers[contractAddress][tokenId];
        require(amount > offer.amount, "There is a higher offer");
        offer.amount = amount;
        offer.from = msg.sender;
    }

    function getBuyOffer(address contractAddress, uint256 tokenId)
        public
        view
        returns (address, uint256)
    {
        BuyOffer memory offer = buyOffers[contractAddress][tokenId];
        return (offer.from, offer.amount);
    }

    function acceptBuyOffer(address contractAddress, uint256 tokenId) public {
        require(
            IERC721(contractAddress).ownerOf(tokenId) == msg.sender,
            "Only owner can accept offer"
        );
        BuyOffer storage offer = buyOffers[contractAddress][tokenId];
        token.transferFrom(offer.from, msg.sender, offer.amount); // TODO market cut
    }

    function createSellOffer(
        address contractAddress,
        uint256 tokenId,
        uint256 price
    ) public {
        require(
            IERC721(contractAddress).ownerOf(tokenId) == msg.sender,
            "Only owner can create a sell offer"
        );
    }

    function takeSellOffer() public {}
}
