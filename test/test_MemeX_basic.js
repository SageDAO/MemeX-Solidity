const { expect } = require("chai");
const { ethers } = require("hardhat");

describe(' TokenMemeXNFT Basic Contract', () => {
    let Factory, factory, owner, addr1, addr2,addr3, NFT, nft, deployedNFT;


    beforeEach(async() => {
        Factory = await ethers.getContractFactory('MemeXFactory');
        [owner, addr1, addr2,addr3, ...addrs] = await ethers.getSigners();
        factory = await Factory.deploy(owner.address);
        NFT = await ethers.getContractFactory("MemeXNFTBasic");
        
        
    })


    describe(' NFT Contract Deploy', () => {
        beforeEach(async() => {
            _name = "MemeXNFT"
            _symbol = "MXN"
            _admin = owner.address
            _lotteryAddress = addr1.address
            tx = await factory.deployMemeXNFT(_name, _symbol)
            const res = await tx.wait()
            nftAddress = res.events[1].args[1]
            deployedNFT = await NFT.attach(nftAddress)
            const name = await deployedNFT.name()
            deployedNFT.setLotteryContract(_lotteryAddress)
            assert(name === "MemeXNFT")
        })


        it("Should mint with minter role", async function () {
            await deployedNFT.connect(owner).addMinterRole(addr2.address)
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
                _uri,
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
    
            await expect(deployedNFT.connect(addr3).create(
                _initialOwner.address,
                _id,
                _initialSupply,
                _maxSupply,
                _uri,
                _data,
                _lotteryId
            )).to.be.revertedWith("ERC1155.create only Lottery or Minter can create")
    
            expect(await deployedNFT.exists(_id))
        })

    })
})