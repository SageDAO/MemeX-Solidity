pragma solidity ^0.8.0;

import "../ERC1155/MemeXNFT.sol";
import "../Utils/CloneFactory.sol";
import "../../interfaces/IMemeXNFT.sol";
import "../Access/MemeXAccessControls.sol";

contract MemeXNFTFactory is CloneFactory, MemeXAccessControls{
//TODO: Add Fees
//TODO : ACCESS CONTROL
    bool public locked;

    uint256 public MemeXNFTTemplateId;
    mapping(uint256 => address) private MemeXNFTTemplates;
    mapping(address => MemeXNFT) public MemeXNFTInfo;
    address[] public MemeXNFTs;
    mapping(address => uint256) private templateToId;
    

    struct MemeXNFT {
        bool exists;
        uint256 templateId;
        uint256 index;
    }

    event NFTCreated(address indexed owner, address indexed addr, address template);
    event TemplateAdded(address template, uint256 templateId);
    event TemplateRemoved(address template, uint256 templateId);

    constructor(){
        locked = true;
    }

    function setLocked(bool _locked) public{
        require(hasOperatorRole(msg.sender)
                 || hasAdminRole(msg.sender),"setLocked: Must be operator or admin");
        locked = _locked;
    }
    function deployMemeXNFT(
        string memory _name,
        string memory _symbol,
        address _lotteryContract,
        string memory _baseUri,
        uint256 _templateId
    ) public returns (address NFT) {
        if (locked){
            require(hasOperatorRole(msg.sender)
                 || hasAdminRole(msg.sender),"deployMemeXNFT: Must be operator or admin");
        }
        require(MemeXNFTTemplates[_templateId] != address(0));
        NFT = createClone(MemeXNFTTemplates[_templateId]);
        IMemeXNFT(NFT).initNFT(_name,_symbol,_lotteryContract);
        MemeXNFTInfo[NFT] = MemeXNFT(true, _templateId, MemeXNFTs.length);
        MemeXNFTs.push(NFT);
        emit NFTCreated(msg.sender, address(NFT),MemeXNFTTemplates[_templateId]);
    }


    function addMemeXNFTTemplate(address _template) public returns (uint256){
        //Add Access Control
        require(hasOperatorRole(msg.sender)
                 || hasAdminRole(msg.sender),"addMemeXNFTemplate: Must be operator or admin");
        require(templateToId[_template] ==0, "addMemeXNFTemplate: Template has already been added");
        MemeXNFTTemplateId += 1;
        MemeXNFTTemplates[MemeXNFTTemplateId] = _template;
        templateToId[_template] = MemeXNFTTemplateId;
        emit TemplateAdded(_template, MemeXNFTTemplateId);
        return MemeXNFTTemplateId;
    }

    function removeMemeXNFTTemplate(uint256 _templateId) public {
        //Add access control
        require(hasOperatorRole(msg.sender)
                 || hasAdminRole(msg.sender),"removeMemeXNFTTemplate: Must be operator or admin");
        require(MemeXNFTTemplates[_templateId] != address(0));
        address template = MemeXNFTTemplates[_templateId];
        MemeXNFTTemplates[_templateId] = address(0);
        delete templateToId[template];
        emit TemplateRemoved(template, _templateId);
    }

    function numberOfNFTs() external view returns (uint256) {
        return MemeXNFTs.length;
    }

    function getTemplate(uint256 _templateId) external view returns (address) {
        return MemeXNFTTemplates[_templateId];
    }

    function getTemplateId(address _template) external view returns (uint256) {
        return templateToId[_template];
    }
}