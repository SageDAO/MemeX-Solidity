//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
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

    mapping(address => uint256) private salesNonces;
    mapping(bytes32 => bool) private cancelledOrders;

    struct Offer {
        address from;
        address nftContract;
        uint32 expiresAt;
        uint256 priceOffer;
        uint256 tokenId;
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

    constructor(address _storage, address _token) {
        sageStorage = ISageStorage(_storage);
        token = IERC20(_token);
    }

    // Builds a prefixed hash to mimic the behavior of eth_sign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function verifySignature(
        address from,
        address contractAddress,
        uint256 price,
        uint256 tokenId,
        uint256 salesNonce,
        bytes calldata signature
    ) internal pure returns (address) {
        bytes32 message = prefixed(
            keccak256(
                abi.encode(from, contractAddress, price, tokenId, salesNonce)
            )
        );
        address recoveredAddress = ECDSA.recover(message, signature);
        require(recoveredAddress == from, "Invalid signature");
        return recoveredAddress;
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

    function buyFromSellOffer(
        address tokenOwner,
        address contractAddress,
        uint256 price,
        uint256 tokenId,
        uint256 salesNonce,
        bytes calldata signature
    ) public {
        address signedOwner = verifySignature(
            tokenOwner,
            contractAddress,
            price,
            tokenId,
            salesNonce,
            signature
        );
        IERC721 nftContract = IERC721(contractAddress);
        address currentOwner = nftContract.ownerOf(tokenId);
        require(signedOwner == currentOwner, "Offer not signed by token owner");
        require(salesNonce == salesNonces[signedOwner], "Wrong nonce");
        incrementSalesNonce(signedOwner);
        nftContract.safeTransferFrom(currentOwner, msg.sender, tokenId, "");
    }

    function incrementSalesNonce(address sellerAddress) private {
        salesNonces[sellerAddress]++;
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
