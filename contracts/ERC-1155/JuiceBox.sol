//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JuiceBox is ERC1155Supply, Ownable {
    using Strings for uint256;

    string public baseURI;

    uint256[] private TIER_CAPS = [
        2000, // TIER 1
        1375, // TIER 2
        700, // TIER 3
        73, // TIER 4
        4 // TIER 5
    ];

    uint256[] private AMOUNT_REQUIRED_TO_UPGRADE_PER_TIER = [
        2, // TIER 1 (2 tier 1 tokens burned = 1 tier 2)
        2, // TIER 2 (2 tier 2 tokens burned = 1 tier 3)
        5, // TIER 3 (5 tier 3 tokens burned = 1 tier 4)
        10 // TIER 4 (10 tier 4 tokens burned = 1 tier 5)
    ];

    event UpgradeTier(
        address indexed userAddress,
        uint256 tier,
        uint256 numberOfUpgrades
    );

    constructor(
        address _to,
        uint256[] memory _tiers,
        uint256[] memory _amounts
    ) ERC1155("") {
        _mintBatch(_to, _tiers, _amounts, "");
    }

    function upgradeTier(uint256 _tier, uint256 _amountOfTokensToMint)
        external
    {
        // only tiers 1 to 4 are upgradeable
        require(_tier > 0 && _tier < 5, "Invalid tier");
        require(
            _amountOfTokensToMint > 0,
            "Number of upgrades must be greater than 0"
        );

        uint256 amountToBurn = AMOUNT_REQUIRED_TO_UPGRADE_PER_TIER[_tier - 1] *
            _amountOfTokensToMint;

        require(
            balanceOf(msg.sender, _tier) >= amountToBurn,
            "Not enough tokens to upgrade"
        );

        uint256 nextTier = _tier + 1;
        require(
            totalSupply(nextTier) + _amountOfTokensToMint <= TIER_CAPS[_tier],
            "Tier is full"
        );

        _burn(msg.sender, _tier, amountToBurn);
        _mint(msg.sender, nextTier, _amountOfTokensToMint, "");
        emit UpgradeTier(msg.sender, _tier, _amountOfTokensToMint);
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
