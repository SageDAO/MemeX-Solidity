const { expect } = require("chai");
const { ethers } = require("hardhat");

const basePath = "ipfs://path/";

describe('MemeXNFT Basic Contract', () => {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        NFT = await ethers.getContractFactory("MemeXNFT");
        _name = "MemeXNFT";
        _symbol = "MXN";
        _admin = owner.address;
        _lotteryAddress = addr1.address;
        nft = await NFT.deploy("Memex", "MEMEX", owner.address);
        await nft.setLotteryContract(_lotteryAddress);
        await nft.createTokenType(1, 10, 1);
        await nft.createCollection(addr1.address, basePath);
    })


    it("Should increase minter balance", async function () {
        await nft.connect(owner).addMinterRole(addr2.address);
        _initialOwner = addr2;
        _id = 1;
        await nft.connect(addr2).mint(_initialOwner.address, _id, 1, []);
        expect(await nft.balanceOf(_initialOwner.address, _id)).to.equal(1);
        expect(await nft.uri(_id)).to.equal(basePath + _id);
    });

    it("Should answer correct uri", async function () {
        await nft.connect(owner).addMinterRole(addr2.address);
        _initialOwner = addr2;
        _id = 1;
        await nft.connect(addr2).mint(_initialOwner.address, _id, 1, []);
        expect(await nft.uri(_id)).to.equal(basePath + _id);
    });

    it("Should not mint without minter role", async function () {
        _initialOwner = addr2;
        _id = 1;

        await expect(nft.connect(addr3).mint(
            _initialOwner.address,
            _id,
            1,
            []
        )
        ).to.be.revertedWith("MemeXNFT: Only Lottery or Minter role can mint");
    })

    it("Should set and calculate royalties", async function () {
        royaltyInfo = await nft.royaltyInfo(1, 100);
        expect(royaltyInfo[0]).to.equal(addr1.address);
        expect(royaltyInfo[1]).to.equal(2);
    });

})