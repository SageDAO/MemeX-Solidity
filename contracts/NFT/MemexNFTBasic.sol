// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "../Access/MemeXAccessControls.sol";

contract MemeXNFTBasic is ERC721, ERC721Enumerable, MemeXAccessControls {
    // address to receive royalty payments
    address public royaltyAddress;

    // percentage stored as basis points. e.g. 10% = 1000
    uint16 public royaltyPercentage;
    uint16 public constant maxRoyalty = 2000;

    address internal lotteryContract;

    string baseMetadataURI;

    event LotteryContractUpdated(
        address oldLotteryContract,
        address newLotteryContract
    );

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseMetadataURI,
        address _royaltyAddress,
        uint16 _royaltyPercentage
    ) ERC721(_name, _symbol) {
        baseMetadataURI = _baseMetadataURI;
        royaltyAddress = _royaltyAddress;
        royaltyPercentage = _royaltyPercentage;
        initAccessControls(msg.sender);
    }

    function setLotteryContract(address _lotteryContract) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change lottery address"
        );
        require(_lotteryContract != address(0));
        address oldAddr = address(lotteryContract);
        lotteryContract = _lotteryContract;
        addSmartContractRole(lotteryContract);
        emit LotteryContractUpdated(oldAddr, _lotteryContract);
    }

    function setRoyaltyPercentage(uint16 _percentage) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change royalties"
        );
        require(
            _percentage <= maxRoyalty,
            "MemeXNFT: Percentage exceeds limit"
        );
        royaltyPercentage = _percentage;
    }

    function setRoyaltyAddress(address _address) public {
        require(
            hasAdminRole(msg.sender),
            "MemeXNFT: Only Admin can change royalty address"
        );
        royaltyAddress = _address;
    }

    function safeMint(address to, uint256 tokenId) public {
        require(
            hasSmartContractRole(msg.sender) || hasMinterRole(msg.sender),
            "MemeXNFT: Only Lottery or Minter role can mint"
        );
        _safeMint(to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseMetadataURI;
    }

    /**
     * @notice Calculates royalties based on a sale price provided, following EIP-2981.
     * Solution is agnostic of the sale price unit and will answer using the same unit.
     * @return  receiver address: address to receive royaltyAmount.
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        return (royaltyAddress, (salePrice * royaltyPercentage) / 10000);
    }
}
