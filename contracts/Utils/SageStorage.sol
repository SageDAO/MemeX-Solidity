//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/ISageStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SageStorage is ISageStorage, AccessControl {
    //    mapping(address => bytes32) private roles;

    bytes32 public constant ADMIN_ROLE = keccak256("role.admin");
    bytes32 public constant ARTIST_ROLE = keccak256("role.artist");
    bytes32 public constant MINTER_ROLE = keccak256("role.minter");
    bytes32 public constant BURNER_ROLE = keccak256("role.burner");
    bytes32 public constant MANAGE_POINTS_ROLE = keccak256("role.points");

    address private constant MULTISIG =
        0x7AF3bA4A5854438a6BF27E4d005cD07d5497C33E;

    /**
     * @dev Throws if not called by the multisig account.
     */
    modifier onlyMultisig() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Multisig calls only");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin calls only");
        _;
    }

    /// @dev Construct
    constructor(address admin) {
        _setupRole(DEFAULT_ADMIN_ROLE, MULTISIG);
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
    }

    // Storage maps
    mapping(bytes32 => string) private stringStorage;
    mapping(bytes32 => bytes) private bytesStorage;
    mapping(bytes32 => uint256) private uintStorage;
    mapping(bytes32 => int256) private intStorage;
    mapping(bytes32 => address) private addressStorage;
    mapping(bytes32 => bool) private booleanStorage;
    mapping(bytes32 => bytes32) private bytes32Storage;

    /// @param _key The key for the record
    function getAddress(bytes32 _key) public view returns (address r) {
        return addressStorage[_key];
    }

    /// @param _key The key for the record
    function getUint(bytes32 _key) public view returns (uint256 r) {
        return uintStorage[_key];
    }

    /// @param _key The key for the record
    function getString(bytes32 _key) public view returns (string memory) {
        return stringStorage[_key];
    }

    /// @param _key The key for the record
    function getBytes(bytes32 _key) public view returns (bytes memory) {
        return bytesStorage[_key];
    }

    /// @param _key The key for the record
    function getBool(bytes32 _key) public view returns (bool r) {
        return booleanStorage[_key];
    }

    /// @param _key The key for the record
    function getInt(bytes32 _key) public view returns (int256 r) {
        return intStorage[_key];
    }

    /// @param _key The key for the record
    function getBytes32(bytes32 _key) public view returns (bytes32 r) {
        return bytes32Storage[_key];
    }

    /// @param _key The key for the record
    function setAddress(bytes32 _key, address _value) public onlyAdmin {
        addressStorage[_key] = _value;
    }

    /// @param _key The key for the record
    function setUint(bytes32 _key, uint256 _value) public onlyAdmin {
        uintStorage[_key] = _value;
    }

    /// @param _key The key for the record
    function setString(bytes32 _key, string calldata _value) public onlyAdmin {
        stringStorage[_key] = _value;
    }

    /// @param _key The key for the record
    function setBytes(bytes32 _key, bytes calldata _value) public onlyAdmin {
        bytesStorage[_key] = _value;
    }

    /// @param _key The key for the record
    function setBool(bytes32 _key, bool _value) public onlyAdmin {
        booleanStorage[_key] = _value;
    }

    /// @param _key The key for the record
    function setInt(bytes32 _key, int256 _value) public onlyAdmin {
        intStorage[_key] = _value;
    }

    /// @param _key The key for the record
    function setBytes32(bytes32 _key, bytes32 _value) public onlyAdmin {
        bytes32Storage[_key] = _value;
    }

    /// @param _key The key for the record
    function deleteAddress(bytes32 _key) public onlyAdmin {
        delete addressStorage[_key];
    }

    /// @param _key The key for the record
    function deleteUint(bytes32 _key) public onlyAdmin {
        delete uintStorage[_key];
    }

    /// @param _key The key for the record
    function deleteString(bytes32 _key) public onlyAdmin {
        delete stringStorage[_key];
    }

    /// @param _key The key for the record
    function deleteBytes(bytes32 _key) public onlyAdmin {
        delete bytesStorage[_key];
    }

    /// @param _key The key for the record
    function deleteBool(bytes32 _key) external onlyAdmin {
        delete booleanStorage[_key];
    }

    /// @param _key The key for the record
    function deleteInt(bytes32 _key) public onlyAdmin {
        delete intStorage[_key];
    }

    /// @param _key The key for the record
    function deleteBytes32(bytes32 _key) public onlyAdmin {
        delete bytes32Storage[_key];
    }

    /// @param _key The key for the record
    /// @param _amount An amount to add to the record's value
    function addUint(bytes32 _key, uint256 _amount) public onlyAdmin {
        uintStorage[_key] = uintStorage[_key] += _amount;
    }

    /// @param _key The key for the record
    /// @param _amount An amount to subtract from the record's value
    function subUint(bytes32 _key, uint256 _amount) public onlyAdmin {
        uintStorage[_key] = uintStorage[_key] -= _amount;
    }
}
