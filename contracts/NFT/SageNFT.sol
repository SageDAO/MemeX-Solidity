// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Utils/StringUtils.sol";

contract SageNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721BurnableUpgradeable,
    ERC721URIStorageUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 private constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 private constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes4 private constant INTERFACE_ID_ERC2981 = 0x2a55205a; // implements ERC-2981 interface

    address private salesDestination;
    uint256 public royaltyPercentage; // in basis points (100 = 1%)
    address public royaltyDestination;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Admin calls only");
        _;
    }

    function initialize(
        string calldata _name,
        string calldata _symbol,
        address _salesDestination,
        uint256 _royaltyPercentage,
        address _royaltyDestination
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
        __ERC721Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        royaltyDestination = _royaltyDestination;
        royaltyPercentage = _royaltyPercentage;
        salesDestination = _salesDestination;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function safeMint(
        address to,
        uint256 tokenId,
        string memory uri
    ) public onlyRole(MINTER_ROLE) {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function withdrawERC20(address erc20) public onlyAdmin {
        IERC20 token = IERC20(erc20);
        uint256 balance = token.balanceOf(address(this));
        uint256 artist = (balance * 8000) / 10000;
        token.transfer(salesDestination, artist);
        token.transfer(msg.sender, balance - artist);
    }

    function withdraw() public onlyAdmin {
        uint256 balance = balanceOf(address(this));
        uint256 artist = (balance * 8000) / 10000;
        (bool sent, ) = salesDestination.call{value: artist}("");
        if (!sent) {
            revert();
        }
        (sent, ) = msg.sender.call{value: balance - artist}("");
    }

    receive() external payable {}

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyAdmin
    {}

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    function burnFromAuthorizedSC(uint256 id) public {
        require(hasRole(BURNER_ROLE, msg.sender), "NFT: No burn privileges");
        _burn(id);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return
            interfaceId == INTERFACE_ID_ERC2981 ||
            interfaceId == type(IAccessControlUpgradeable).interfaceId ||
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
        return (royaltyDestination, (salePrice * royaltyPercentage) / 10000);
    }

    function getSalesDestination() public view returns (address) {
        return salesDestination;
    }
}
