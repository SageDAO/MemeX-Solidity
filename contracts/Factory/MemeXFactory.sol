pragma solidity ^0.8.0;

import "../Utils/CloneFactory.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../Access/MemeXAccessControls.sol";
import "../ERC1155/MemeXNFTBasic.sol";

contract MemeXFactory is MemeXAccessControls{

    bool public locked;

    
    mapping(address => MemeXNFT) public MemeXNFTInfo;
    address[] public MemeXNFTs;

    
    
    struct MemeXNFT {
        bool exists;
        uint256 index;
    }

    event NFTCreated(address indexed owner, address indexed addr);
    event TemplateAdded(address template, uint256 templateId);
    event TemplateRemoved(address template, uint256 templateId);

    constructor(address _admin){
        locked = true;
        initAccessControls(_admin);
    }


    function setLocked(bool _locked) public{
        require(hasOperatorRole(msg.sender)
                 || hasAdminRole(msg.sender),"setLocked: Must be operator or admin");
        locked = _locked;
    }

    //admin is always msg.sender
    function deployMemeXNFT(
        string memory _name,
        string memory _symbol
     
    ) public returns (address) {
        if (locked){
            require(hasOperatorRole(msg.sender)
                 || hasAdminRole(msg.sender),"deployMemeXNFT: Must be operator or admin");
        }
        address NFT = address(new MemeXNFTBasic(_name,_symbol,msg.sender));
        MemeXNFTInfo[NFT] = MemeXNFT(true,MemeXNFTs.length);
        MemeXNFTs.push(NFT);
        emit NFTCreated(msg.sender, address(NFT));
        return NFT;
    }

    function numberOfNFTs() external view returns (uint256) {
        return MemeXNFTs.length;
    }

    function getDeployedChildContracts() public view returns(address[] memory){
        return MemeXNFTs;
    }
    
    function getChildContract(uint256 _id) public view returns(address NFT){
        NFT = MemeXNFTs[_id];
    }
}