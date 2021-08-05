pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
//import "@openzeppelin/contracts/ownership/Ownable.sol";

contract MemeXNFT is ERC1155(""){
    using SafeMath for uint256;
    string public name;
    // Contract symbol
    string public symbol;
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    address internal lotteryContract;

    uint256 internal totalSupply;
    mapping(uint256 => uint256) tokenSupply;
    struct TicketInfo {
        address owner;
        bool claimed;
        uint256 lotteryId;
    }
    mapping(uint256 => TicketInfo) internal ticketInfo;
    // User address => Lottery ID => Ticket IDs
    mapping(address => mapping(uint256 => uint256[])) internal userTickets;
    
    event InfoBatchMint(
        address indexed receiving, 
        uint256 lotteryId,
        uint256 amountOfTokens, 
        uint256[] tokenIds
    );

    constructor(
        string memory _name,
        string memory _symbol
    ) public {
        name = _name;
        symbol = _symbol;
    }


    function mint(
        address _to,
        uint256 _id,
        uint256 _quantity,
        bytes memory _data
        ) public  {
            _mint(_to, _id, _quantity, _data);
            tokenSupply[_id] = tokenSupply[_id].add(_quantity);
    }

    

    function batchMint(
        address _to,
        uint256 _lotteryId,
        uint8 _numberOfTickets,
        uint8 sizeOfLottery
    )
        external
        returns(uint256[] memory)
    {
        // Storage for the amount of tokens to mint (always 1)
        uint256[] memory amounts = new uint256[](_numberOfTickets);
        // Storage for the token IDs
        uint256[] memory tokenIds = new uint256[](_numberOfTickets);
        for (uint8 i = 0; i < _numberOfTickets; i++) {
            totalSupply = totalSupply.add(1);
            tokenIds[i] = totalSupply;
            amounts[i] = 1;
            
            ticketInfo[totalSupply] = TicketInfo(
                _to,
                false,
                _lotteryId
            );
            userTickets[_to][_lotteryId].push(totalSupply);
        }
        // Minting the batch of tokens
        _mintBatch(
            _to,
            tokenIds,
            amounts,
            msg.data
        );
        // Emitting relevant info
        emit InfoBatchMint(
            _to, 
            _lotteryId,
            _numberOfTickets, 
            tokenIds
        ); 
        // Returns the token IDs of minted tokens
        return tokenIds;
    }
   /*  function uri(uint256 _id) public override view returns (string memory) {
        return string(abi.encodePacked(super.uri(_id), toHexString(_id), ".json"));
    } */



    function claimTicket(uint256 _ticketID, uint256 _lotteryId) external returns(bool) {
        require(
            ticketInfo[_ticketID].claimed == false,
            "Ticket already claimed"
        );
        require(
            ticketInfo[_ticketID].lotteryId == _lotteryId,
            "Ticket not for this lottery"
        );
        
        ticketInfo[_ticketID].claimed = true;
        return true;
    }

    function setURI(string memory newUri) public {
        _setURI(newUri);
    }
      /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
    

    

}