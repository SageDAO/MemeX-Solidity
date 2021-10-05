const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('MemeXNFT Basic Contract', () => {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        NFT = await ethers.getContractFactory("MemeXNFTBasic");
        _name = "MemeXNFT"
        _symbol = "MXN"
        _admin = owner.address
        _lotteryAddress = addr1.address
        nft = await NFT.deploy("Memex", "MEMEX", "ipfs://", owner.address, 200);
        nft.setLotteryContract(_lotteryAddress)
    })


    it("Should mint with minter role", async function () {
        await nft.connect(owner).addMinterRole(addr2.address)
        _initialOwner = addr2
        _id = 2
        await nft.connect(addr1).safeMint(
            _initialOwner.address,
            _id,
        )

        expect(await nft.ownerOf(_id)).to.equal(_initialOwner.address);
    })

    it("Should not mint without minter role", async function () {
        _initialOwner = addr2
        _id = 2
        _initialSupply = 1
        _maxSupply = 1
        _uri = ""
        _data = []
        _lotteryId = 1

        await expect(nft.connect(addr3).safeMint(
            _initialOwner.address,
            _id,
        )
        ).to.be.revertedWith("MemeXNFT: Only Lottery or Minter role can mint")
    })

    it("Should set and calculate royalties", async function () {
        await nft.setRoyaltyAddress(addr1.address);
        await nft.setRoyaltyPercentage(200); // 2.00 %
        roaytlyInfo = await nft.royaltyInfo(1, 100);
        expect(roaytlyInfo[0]).to.equal(addr1.address);
        expect(roaytlyInfo[1]).to.equal(2);
    });

    it("Should not allow royalty bigger than limit", async function () {
        await nft.setRoyaltyAddress(addr1.address);
        await expect(nft.setRoyaltyPercentage(5000)) // 50.00 %
            .to.be.revertedWith("MemeXNFT: Percentage exceeds limit");
    });
})