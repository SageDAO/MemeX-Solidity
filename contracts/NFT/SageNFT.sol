// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Utils/StringUtils.sol";
import "../../interfaces/ISageStorage.sol";

contract SageNFT is
    ERC721,
    ERC721Enumerable,
    ERC721Burnable,
    ERC721URIStorage,
    Ownable
{
    ISageStorage immutable sageStorage;
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    uint256 private constant DEFAULT_ROYALTY_PERCENTAGE = 1000; // in basis points (100 = 1%)

    bytes4 private constant INTERFACE_ID_ERC2981 = 0x2a55205a; // implements ERC-2981 interface

    constructor(
        string memory _name,
        string memory _symbol,
        address _sageStorage
    ) ERC721(_name, _symbol) {
        sageStorage = ISageStorage(_sageStorage);
    }

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(
            sageStorage.hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Admin calls only"
        );
        _;
    }

    function artistMint(
        address to,
        uint256 tokenId,
        string calldata uri
    ) public onlyOwner {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function safeMint(
        address to,
        uint256 tokenId,
        string calldata uri
    ) public {
        require(
            sageStorage.hasRole(sageStorage.MINTER_ROLE(), msg.sender),
            "No minting rights"
        );
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function withdrawERC20(address erc20) public onlyAdmin {
        IERC20 token = IERC20(erc20);
        uint256 balance = token.balanceOf(address(this));
        uint256 artist = (balance * 8000) / 10000;
        token.transfer(owner(), artist);
        token.transfer(msg.sender, balance - artist);
    }

    function withdraw() public onlyAdmin {
        uint256 balance = address(this).balance;
        uint256 artist = (balance * 8000) / 10000;
        (bool sent, ) = owner().call{value: artist}("");
        if (!sent) {
            revert();
        }
        (sent, ) = msg.sender.call{value: balance - artist}("");
        if (!sent) {
            revert();
        }
    }

    receive() external payable {}

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    function burnFromAuthorizedAddress(uint256 id) public {
        require(
            sageStorage.hasRole(sageStorage.BURNER_ROLE(), msg.sender),
            "No burning rights"
        );
        _burn(id);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        override(ERC721, IERC721)
        returns (bool)
    {
        if (
            sageStorage.getAddress(
                keccak256(abi.encodePacked("address.marketplace"))
            ) == operator
        ) {
            return true;
        }
        return super.isApprovedForAll(owner, operator);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return
            interfaceId == INTERFACE_ID_ERC2981 ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Calculates royalties based on a sale price provided following EIP-2981.
     * Solution is agnostic of the sale price unit and will answer using the same unit.
     * @return  address to receive royaltyAmount, amount to be paid as royalty.
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address, uint256)
    {
        return (
            address(this),
            (salePrice * DEFAULT_ROYALTY_PERCENTAGE) / 10000
        );
    }
}
