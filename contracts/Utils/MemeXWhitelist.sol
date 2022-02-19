//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IMemeXWhitelist.sol";
import "../Access/MemeXAccessControls.sol";

interface IBalanceOf {
    function balanceOf(address owner) external view returns (uint256 balance);
}

contract MemeXWhitelist is MemeXAccessControls, IMemeXWhitelist {
    mapping(uint256 => WhitelistTarget[]) public whitelist;

    struct WhitelistTarget {
        // user must have a balance on contractAddress of at least minBalance to be whitelisted
        address contractAddress;
        uint256 minBalance;
    }

    constructor(address _owner) {
        initAccessControls(_owner);
    }

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(hasAdminRole(msg.sender), "Admin calls only");
        _;
    }

    function isWhitelisted(address _address, uint256 _collectionId)
        public
        view
        returns (bool)
    {
        WhitelistTarget[] memory targets = whitelist[_collectionId];
        for (uint256 i = 0; i < targets.length; i++) {
            WhitelistTarget memory target = targets[i];
            if (
                // works for ERC-20 or ERC-721 tokens
                IBalanceOf(target.contractAddress).balanceOf(_address) >=
                target.minBalance
            ) {
                return true;
            }
        }
        return false;
    }

    function addAddress(
        address _address,
        uint256 _minBalance,
        uint256 _collectionId
    ) public onlyAdmin {
        require(_minBalance > 0, "Min balance must be greater than 0");
        WhitelistTarget memory param = WhitelistTarget(_address, _minBalance);
        whitelist[_collectionId].push(param);
    }

    function removeAddress(address _address, uint256 _collectionId)
        public
        onlyAdmin
    {
        WhitelistTarget[] storage list = whitelist[_collectionId];

        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].contractAddress == _address) {
                list[i] = list[list.length - 1];
                list.pop();
                return;
            }
        }
    }
}
