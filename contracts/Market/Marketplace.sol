//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/INFT.sol";
import "../../interfaces/IERC2981.sol";
import "../../interfaces/ISageStorage.sol";

contract Marketplace {
    IERC20 public token;
    ISageStorage immutable sageStorage;

    mapping(bytes32 => bool) private cancelledOrders;

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
        uint256 expiresAt,
        bool sellOrder,
        bytes calldata signature
    ) internal pure returns (address, bytes32) {
        bytes32 message = prefixed(
            keccak256(
                abi.encode(
                    from,
                    contractAddress,
                    price,
                    tokenId,
                    expiresAt,
                    sellOrder
                )
            )
        );
        address recoveredAddress = ECDSA.recover(message, signature);
        require(recoveredAddress == from, "Invalid signature");
        return (recoveredAddress, message);
    }

    function cancelSignedOffer(
        address from,
        address contractAddress,
        uint256 price,
        uint256 tokenId
    ) public {
        require(msg.sender == from, "Can only cancel own offers");

        bytes32 message = prefixed(
            keccak256(abi.encode(from, contractAddress, price, tokenId))
        );
        cancelledOrders[message] = true;
    }

    function buyFromSellOffer(
        address tokenOwner,
        address contractAddress,
        uint256 price,
        uint256 tokenId,
        uint256 expiresAt,
        bytes calldata signature
    ) public {
        require(expiresAt > block.timestamp, "Offer expired");
        (address signedOwner, bytes32 message) = verifySignature(
            tokenOwner,
            contractAddress,
            price,
            tokenId,
            expiresAt,
            true,
            signature
        );
        IERC721 nftContract = IERC721(contractAddress);
        address currentOwner = nftContract.ownerOf(tokenId);
        require(signedOwner == currentOwner, "Offer not signed by token owner");

        require(!cancelledOrders[message], "Offer was cancelled");
        cancelledOrders[message] = true;
        nftContract.safeTransferFrom(currentOwner, msg.sender, tokenId, "");
        (address royaltyDest, uint256 royaltyValue) = IERC2981(contractAddress)
            .royaltyInfo(tokenId, price);
        token.transferFrom(msg.sender, royaltyDest, royaltyValue);
        token.transferFrom(msg.sender, tokenOwner, price - royaltyValue);
        emit ListedNFTSold(msg.sender, tokenId, price);
    }

    function sellFromBuyOffer(
        address from,
        address contractAddress,
        uint256 price,
        uint256 tokenId,
        uint256 expiresAt,
        bytes calldata signature
    ) public {
        require(expiresAt > block.timestamp, "Offer expired");
        (address signedBy, bytes32 message) = verifySignature(
            from,
            contractAddress,
            price,
            tokenId,
            expiresAt,
            false,
            signature
        );
        IERC721 nftContract = IERC721(contractAddress);
        address currentOwner = nftContract.ownerOf(tokenId);
        require(msg.sender == currentOwner, "Not the token owner");
        require(from == signedBy, "Invalid signature");

        require(!cancelledOrders[message], "Offer was cancelled");
        cancelledOrders[message] = true;
        nftContract.safeTransferFrom(currentOwner, from, tokenId, "");
        (address royaltyDest, uint256 royaltyValue) = IERC2981(contractAddress)
            .royaltyInfo(tokenId, price);
        token.transferFrom(from, royaltyDest, royaltyValue);
        token.transferFrom(from, currentOwner, price - royaltyValue);
        emit ListedNFTSold(from, tokenId, price);
    }
}
