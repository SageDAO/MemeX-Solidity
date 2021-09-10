const { expect, assert } = require('chai');
const { artifacts } = require('hardhat');

const NFTArtifact = artifacts.require('MemeXNFT.sol')
describe(' Factory Contract', () => {
    let Factory, factory, owner, addr1, addr2, NFT, nft;

    beforeEach(async () => {
        Factory = await ethers.getContractFactory('MemeXNFTFactory');
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        factory = await Factory.deploy();
        NFT = await ethers.getContractFactory('MemeXNFT');
        nft = await NFT.deploy();
        
    });

    describe('Deployment', () => {
        
        it('Should set the right owner', async function (){
            expect(await factory.hasAdminRole(owner.address))
        });
    })

    describe('Deploy a MemeXNFT', () => {
        it('Should Deploy with Correct NFT', async function () {
            tx = await factory.addMemeXNFTTemplate(nft.address)
            const res = await tx.wait()
            template_id = res.events[0].args[1].toNumber()
            _name = "MemeXNFT"
            _symbol = "MXN"
            _lotteryAddress = addr1.address
            _baseUri = "nothing yet"
            tx2 = await  factory.deployMemeXNFT(_name, _symbol, _lotteryAddress, _baseUri, template_id)
            const res2 = await tx2.wait()
            proxyAddress = res2.events[0].args[1]
            console.log(proxyAddress)
            const deployedNFT = await NFTArtifact.at(proxyAddress)
            const name = await deployedNFT.name.call()
            console.log(name)
            assert(name === "MemeXNFT")
        })
    })
    
    describe("Add and Remove Templates", () => {

        it('Should revert with same NFT template added twice', async function() {
            tx = await factory.addMemeXNFTTemplate(nft.address)
            const res = await tx.wait()
            tx = await expect(factory.addMemeXNFTTemplate(nft.address)
                ).to.be.revertedWith("addMemeXNFTemplate: Template has already been added")
        })

        it('Should remove the Template with template Id', async () => {
            tx = await factory.addMemeXNFTTemplate(nft.address)
            const res = await tx.wait()
            template_id = res.events[0].args[1].toNumber()
            tx = await factory.removeMemeXNFTTemplate(template_id)
            expectedTemplateId = 0
            expect(await factory.templateToId(nft.address)).to.equal(0)
            
    })

});

});



  