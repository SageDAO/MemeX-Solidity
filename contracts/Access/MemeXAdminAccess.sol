//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract MemeXAdminAccess is AccessControl {
    /// @dev Whether access is initialised.
    bool private initAccess;

    /// @notice Events for adding and removing various roles.
    event AdminRoleGranted(address indexed beneficiary, address indexed caller);

    event AdminRoleGranted2(address indexed beneficiary);

    event AdminRoleRemoved(address indexed beneficiary, address indexed caller);

    /// @notice The deployer is automatically given the admin role which will allow them to then grant roles to other addresses.
    function initAccessControls(address _admin) public {
        require(!initAccess, "Already initialised");
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        initAccess = true;
    }

    /////////////
    // Lookups //
    /////////////

    /**
     * @notice Used to check whether an address has the admin role.
     * @param _address EOA or contract being checked.
     * @return bool True if the account has the role or false if it does not.
     */
    function hasAdminRole(address _address) public view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, _address);
    }

    ///////////////
    // Modifiers //
    ///////////////

    /**
     * @notice Grants the admin role to an address.
     * @dev The sender must have the admin role.
     * @param _address EOA or contract receiving the new role.
     */
    function addAdminRole(address _address) external {
        grantRole(DEFAULT_ADMIN_ROLE, _address);
        emit AdminRoleGranted(_address, _msgSender());
    }

    /**
     * @notice Removes the admin role from an address.
     * @dev The sender must have the admin role.
     * @param _address EOA or contract affected.
     */
    function removeAdminRole(address _address) external {
        revokeRole(DEFAULT_ADMIN_ROLE, _address);
        emit AdminRoleRemoved(_address, _msgSender());
    }

    function msgSender() public view returns (address) {
        return _msgSender();
    }
}
