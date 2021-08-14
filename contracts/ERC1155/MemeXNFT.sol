pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./String.sol";

contract MemeXNFT is Ownable, ERC1155 {
    using SafeMath for uint256;
    using Strings for string;
    string public name;
    mapping(uint256 => address) public creators;
    // Contract symbol
    string public symbol;
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    address internal lotteryContract;

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

    constructor(string memory _name, string memory _symbol)
        ERC1155(
            "ipfs://"
        )
    {
        
        name = _name;
        symbol = _symbol;
    }

    function setLotteryContract(address _lotteryContract) public onlyOwner {
        require(_lotteryContract != address(0));
        address oldAddr = address(lotteryContract);
        lotteryContract = _lotteryContract;
        emit LotteryContractUpdated(oldAddr, lotteryContract);
    }

    modifier onlyLottery() {
        require(
            msg.sender == address(lotteryContract),
            "Only Lottery contract can call"
        );
        _;
    }

    ///@dev use this function to mint the tokens with lottery contract
    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data,
        uint256 _lotteryId
    ) public  onlyLottery{
        _mint(_to, _id, _quantity, _data);
        creators[_id] = _to;
        nftInfo.push(NFTInfo(_to, true, _lotteryId));
    }

    function batchMint(
        address _to,
        uint256[] memory _ids,
        uint256[] memory _quantities,
        bytes memory _data
    ) public onlyLottery {
        for (uint256 i = 0; i < _ids.length; i++) {
            uint256 _id = _ids[i];
            uint256 quantity = _quantities[i];
            tokenSupply[_id] = tokenSupply[_id].add(quantity);
        }
        _mintBatch(_to, _ids, _quantities, _data);
    }

    function setBaseMetadataURI(string memory _newBaseMetadataURI)
        external
        onlyLottery
        
    {
        _setURI(_newBaseMetadataURI);
    }

/*     function uri(uint256 _id) public view override returns (string memory) {
         require(_exists(_id), "ERC721Tradable#uri: NONEXISTENT_TOKEN");
         // returns <base_path>/<prizeId>.json
         return
             Strings.strConcat(
                 baseMetadataURI,
                 "/",
                 Strings.uint2str(_id),
             ".json"
            );
     }
 */
     

    function getLotteryId(uint256 _tokenId) public view returns (uint256) {
        return nftInfo[_tokenId].lotteryId;
    }

    function getNFTInfo(uint256 _tokenId) public view returns (NFTInfo memory) {
        return nftInfo[_tokenId];
    }

    function _exists(uint256 _id) internal view returns (bool) {
        return creators[_id] != address(0);
    }
}
