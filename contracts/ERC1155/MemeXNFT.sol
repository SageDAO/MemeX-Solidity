pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./String.sol";

//import "@openzeppelin/contracts/ownership/Ownable.sol";

contract MemeXNFT is ERC1155("") {
    using SafeMath for uint256;
    using Strings for string;
    string internal baseMetadataURI;
    string public name;
    mapping(uint256 => address) public creators;
    // Contract symbol
    string public symbol;
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    address internal lotteryContract;

    address public owner;
    mapping(uint256 => uint256) tokenSupply;

    struct NFTInfo {
        address owner;
        bool minted;
        uint256 lotteryId;
    }

    NFTInfo[] public nftInfo;

    event LotteryContractUpdated(
        address oldLotteryContract,
        address newLotteryContract
    );

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    // add owner
    function setLotteryContract(address _lotteryContract) public {
        require(owner == msg.sender);
        require(lotteryContract != address(0));
        lotteryContract = _lotteryContract;
        address oldAddr = address(lotteryContract);
        emit LotteryContractUpdated(oldAddr, lotteryContract);
    }

    ///@dev use this function to mint the tokens with lottery contract
    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data,
        uint256 _lotteryId
    ) public {
        require(
            msg.sender == lotteryContract,
            "Only lottery contract can mint"
        );
        _mint(_to, _id, _quantity, _data);
        creators[_id] = msg.sender;
        nftInfo.push(NFTInfo(_to, true, _lotteryId));
    }

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public {
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
            uint256 quantity = _quantities[i];
            tokenSupply[_id] = tokenSupply[_id].add(quantity);
        }
        _mintBatch(_to, _ids, _quantities, _data);
    }

    function _setBaseMetadataURI(string memory _newBaseMetadataURI) internal {
        baseMetadataURI = _newBaseMetadataURI;
    }

    function uri(uint256 _id) public view override returns (string memory) {
        require(_exists(_id), "ERC721Tradable#uri: NONEXISTENT_TOKEN");
        return Strings.strConcat(baseMetadataURI, Strings.uint2str(_id));
    }

    function getLotteryId(uint256 _tokenId) public view returns (uint256) {
        return nftInfo[_tokenId].lotteryId;
    }

    function _exists(uint256 _id) internal view returns (bool) {
        return creators[_id] != address(0);
    }
}
