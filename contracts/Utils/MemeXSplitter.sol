//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Access/MemeXAccessControls.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MemeXSplitter is MemeXAccessControls {
    address[] public destinations;

    uint16[] public weights;

    uint16 totalWeight;

    modifier onlyAdmin() {
        require(hasAdminRole(msg.sender), "Admin calls only");
        _;
    }

    constructor(
        address _admin,
        address[] memory _destinations,
        uint16[] memory _weights
    ) {
        initAccessControls(_admin);
        destinations = _destinations;
        weights = _weights;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
    }

    function setDestinations(address[] memory _destinations) public onlyAdmin {
        destinations = _destinations;
    }

    function setWeights(uint16[] memory _weights) public onlyAdmin {
        weights = _weights;
        totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
    }

    function splitERC20(uint256 _amount, address _erc20Address) public payable {
        if (_erc20Address != address(0)) {
            require(
                IERC20(_erc20Address).balanceOf(address(this)) >= _amount,
                "Not enough balance"
            );
        }

        uint16 _totalWeight = totalWeight;
        for (uint256 i = 0; i < destinations.length; i++) {
            uint256 amountPerDestination = (_amount * weights[i]) /
                _totalWeight;
            if (_erc20Address != address(0)) {
                IERC20(_erc20Address).transfer(
                    destinations[i],
                    amountPerDestination
                );
            }
        }
    }

    function split(uint256 _amount) public payable {
        require((address(this).balance) >= _amount, "Not enough balance");

        uint16 _totalWeight = totalWeight;
        for (uint256 i = 0; i < destinations.length; i++) {
            uint256 amountPerDestination = (_amount * weights[i]) /
                _totalWeight;
            (bool sent, ) = destinations[i].call{value: amountPerDestination}(
                ""
            );
            if (!sent) {
                revert();
            }
        }
    }

    receive() external payable {}
}
