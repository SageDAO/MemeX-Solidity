//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Access/MemeXAccessControls.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MemeXSplitter is MemeXAccessControls {
    address[] public destinations;

    uint256[] public weights;

    modifier onlyAdmin() {
        require(hasAdminRole(msg.sender), "Admin calls only");
        _;
    }

    constructor(
        address _admin,
        address[] memory _destinations,
        uint256[] memory _weights
    ) {
        initAccessControls(_admin);
        destinations = _destinations;
        weights = _weights;
    }

    function setDestinations(address[] memory _destinations) public onlyAdmin {
        destinations = _destinations;
    }

    function setWeights(uint256[] memory _weights) public onlyAdmin {
        weights = _weights;
    }

    function split(uint256 _amount, address _erc20Address) public payable {
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }

        if (_erc20Address != address(0)) {
            require(
                IERC20(_erc20Address).balanceOf(address(this)) >= _amount,
                "Not enough balance"
            );
        } else {
            // require balance >= amount
            require((address(this).balance) >= _amount, "Not enough balance");
        }

        for (uint256 i = 0; i < destinations.length; i++) {
            uint256 amountPerDestination = (_amount * weights[i]) / totalWeight;
            if (_erc20Address != address(0)) {
                IERC20(_erc20Address).transfer(
                    destinations[i],
                    amountPerDestination
                );
            } else {
                (bool sent, ) = destinations[i].call{
                    value: amountPerDestination
                }("");
                if (!sent) {
                    revert();
                }
            }
        }
    }

    receive() external payable {
        split(msg.value, address(0));
    }
}
