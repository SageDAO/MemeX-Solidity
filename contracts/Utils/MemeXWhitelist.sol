//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IMemeXWhitelist.sol";
import "../Access/MemeXAccessControls.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MemeXWhitelist is MemeXAccessControls, IMemeXWhitelist {
    mapping(uint256 => address[]) public whitelist;

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
        address[] memory list = whitelist[_collectionId];
        for (uint256 i = 0; i < list.length; i++) {
            if (IERC721(list[i]).balanceOf(_address) > 0) {
                return true;
            }
        }
        return false;
    }

    function addAddress(address _address, uint256 _collectionId)
        public
        onlyAdmin
    {
        whitelist[_collectionId].push(_address);
    }

    function removeAddress(address _address, uint256 _collectionId)
        public
        onlyAdmin
    {
        address[] storage list = whitelist[_collectionId];

        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == _address) {
                list[i] = list[list.length - 1];
                list.pop();
                return;
            }
        }
    }
}
