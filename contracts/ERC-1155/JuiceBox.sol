//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JuiceBox is ERC1155Supply, Ownable {
    using Strings for uint256;

    string private baseURI;

    bool private doneMinting;

    uint256 public constant MAX_JUICES = 3555;

    uint256[] public TIER_CAPS = [
        0, // unused position so we can have index 1 == tier 1 and so on
        1500, // TIER 1
        1000, // TIER 2
        750, // TIER 3
        350, // TIER 4
        55 // TIER 5
    ];

    // support ERC-2981 Royalty Standard
    bytes4 private constant INTERFACE_ID_ERC2981 = 0x2a55205a;

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == INTERFACE_ID_ERC2981 ||
            super.supportsInterface(interfaceId);
    }

    constructor() ERC1155("") {}

    function mintBatch(uint256[] memory _tiers, uint256[] memory _amounts)
        external
        onlyOwner
    {
        require(!doneMinting, "JuiceBox already minted");
        doneMinting = true;

        uint256 total;
        for (uint256 i = 0; i < _tiers.length; i++) {
            total += _amounts[i];
        }
        require(
            total == MAX_JUICES,
            "Total amount of juices must be exactly 3555"
        );
        _mintBatch(owner(), _tiers, _amounts, "");
    }

    function upgradeTier(uint256 _tier) external {
        require(_tier > 0 && _tier < 5, "Invalid tier");
        require(
            balanceOf(msg.sender, _tier) >= 10,
            "Not enough tokens to upgrade"
        );
        uint256 nextTier = _tier + 1;
        require(totalSupply(nextTier) < TIER_CAPS[nextTier], "Tier is full");

        _burn(msg.sender, _tier, 10);
        _mint(msg.sender, nextTier, 1, "");
    }

    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function getBaseURI() external view returns (string memory) {
        return baseURI;
    }

    function uri(uint256 _tier) public view override returns (string memory) {
        return string.concat(baseURI, _tier.toString());
    }
}
