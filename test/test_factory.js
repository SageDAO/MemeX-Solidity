const { expect, assert } = require('chai');
const { artifacts } = require('hardhat');

const NFTArtifact = artifacts.require('MemeXNFT.sol')
describe(' Factory Contract', () => {
    let Factory, factory, owner, addr1, addr2, NFT, nft;

    beforeEach(async () => {
        Factory = await ethers.getContractFactory('MemeXNFTFactory');
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        factory = await Factory.deploy(owner.address);
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
            _admin = owner.address
            _lotteryAddress = addr1.address
            _baseUri = "nothing yet"
            tx2 = await  factory.deployMemeXNFT(_name, _symbol, _lotteryAddress, _admin,_baseUri, template_id)
            const res2 = await tx2.wait()
            proxyAddress = res2.events[1].args[1]

            const deployedNFT = await NFTArtifact.at(proxyAddress)
            const name = await deployedNFT.name.call()
            assert(name === "MemeXNFT")
        })

        it('Should increase number Of NFTs deployed', async function () {
            tx = await factory.addMemeXNFTTemplate(nft.address)
            const res = await tx.wait()
            template_id = res.events[0].args[1].toNumber()
            _name = "MemeXNFT"
            _symbol = "MXN"
            _admin = owner.address
            _lotteryAddress = addr1.address
            _baseUri = "nothing yet"
            tx2 = await  factory.deployMemeXNFT(_name, _symbol, _lotteryAddress, _admin,_baseUri, template_id)

            __name = "MemeXNFT2"
            _symbol = "MXN2"
            _lotteryAddress = addr1.address
            _baseUri = "nothing yet"
            tx2 = await  factory.deployMemeXNFT(_name, _symbol, _lotteryAddress, _admin,_baseUri, template_id)

            expect(await factory.numberOfNFTs()).to.equal(2)

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
            expect(await factory.getTemplateId(nft.address)).to.equal(0)
            
        })

        it('Should add two NFT Template', async () => {
            tx = await factory.addMemeXNFTTemplate(nft.address)
            const res = await tx.wait()
            template_id = res.events[0].args[1].toNumber()
            assert(template_id === 1)

            NFT2 = await ethers.getContractFactory('MemeXNFT');
            nft2 = await NFT.deploy();

            tx = await factory.addMemeXNFTTemplate(nft2.address)
            const res2 = await tx.wait()
            template_id = res2.events[0].args[1].toNumber()
            assert(template_id === 2)
        })



});

});



  