pragma solidity ^0.8.0;

import "../ERC1155/MemeXNFT.sol";
import "../Utils/CloneFactory.sol";
import "../../interfaces/IMemeXNFT.sol";
contract MemeXNFTFactory is CloneFactory{
//TODO TEMPLATE ID
//TODO : ACCESS CONTROL
    bool public locked;

    uint256 public MemeXNFTTemplateId;
    mapping(uint256 => address) private MemeXNFTTemplates;

    struct MemeXNFT {
        bool exists;
        uint256 index;
    }

    mapping(address => MemeXNFT) public memeXInfo;
    address[] memeXs;

    function deployMemeXNFT(
        string memory _name,
        string memory _symbol,
        address _lotteryContract,
        string memory _baseUri,
        uint256 _templateId
    ) public returns (address NFT) {
        NFT = createClone(MemeXNFTTemplates[1]);
        IMemeXNFT(NFT).initNFT(_name,_symbol,_lotteryContract);
    }

    function addMemeXNFTTemplate(address _template) public{
        MemeXNFTTemplates[1] = _template;
    }
}