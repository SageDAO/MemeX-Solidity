const { artifacts } = require('hardhat');


const NFTArtifact = artifacts.require('MemeXNFT.sol')
describe(' ERC1155 Contract', () => {
    let Factory, factory, owner, addr1, addr2, NFT, nft, deployedNFT;

    beforeEach(async () => {
        Factory = await ethers.getContractFactory('MemeXNFTFactory');
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        factory = await Factory.deploy(owner.address);
        NFT = await ethers.getContractFactory('MemeXNFT');
        nft = await NFT.deploy();
        
        tx = await factory.addMemeXNFTTemplate(nft.address)
        const res = await tx.wait()
        template_id = res.events[0].args[1].toNumber()
        _name = "MemeXNFT"
        _symbol = "MXN"
        _admin = owner.address
        _lotteryAddress = addr1.address
        tx2 = await factory.deployMemeXNFT(_name, _symbol, _lotteryAddress,_admin, template_id)
        
        const res2 = await tx2.wait()
        proxyAddress = res2.events[1].args[1]
        deployedNFT = await NFT.attach(proxyAddress)
        const name = await deployedNFT.name()
        assert(name === "MemeXNFT")
    });
    
    describe(' Check Create with account having Minter Role', () => {
        
        it("Should mint with minter role", async function () {
        await deployedNFT.connect(owner).addMinterRole(addr1.address)
        _initialOwner = addr2
        _id = 2
        _initialSupply = 1
        _maxSupply = 1
        _uri = ""
        _data = []
        _lotteryId = 1
        await deployedNFT.connect(addr1).create(
            _initialOwner.address,
            _id,
            _initialSupply,
            _maxSupply,
            
            _data,
            _lotteryId
        )

        expect(await deployedNFT.exists(_id))
    })
    
    it("Should not mint without minter role", async function () {
        _initialOwner = addr2
        _id = 2
        _initialSupply = 1
        _maxSupply = 1
        _uri = ""
        _data = []
        _lotteryId = 1

        await expect(deployedNFT.connect(addr1).create(
            _initialOwner.address,
            _id,
            _initialSupply,
            _maxSupply,
          
            _data,
            _lotteryId
        )).to.be.revertedWith("ERC1155.create only Lottery or Minter can create")

        expect(await deployedNFT.exists(_id))
    })
})

    
})