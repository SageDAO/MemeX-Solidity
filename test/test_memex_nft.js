const { expect } = require("chai");
const { ethers } = require("hardhat");

const basePath = "ipfs://path/";

describe('MemeXNFT Contract', () => {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        NFT = await ethers.getContractFactory("MemeXNFT");
        _name = "MemeXNFT";
        _symbol = "MXN";
        _admin = owner.address;
        _lotteryAddress = addr1.address;
        nft = await NFT.deploy("Memex", "MEMEX", owner.address);
        await nft.addSmartContractRole(_lotteryAddress);
        await nft.createTokenType(1, 10, 1);
        await nft.createCollection(addr1.address, basePath);
        await nft.connect(owner).addMinterRole(addr2.address);
        _id = 1;
        await nft.connect(addr2).mint(addr2.address, _id, 1, []);
    })

    it("Should increase minter balance", async function () {
        expect(await nft.balanceOf(addr2.address, _id)).to.equal(1);
    });

    it("Should answer correct uri", async function () {
        await nft.connect(addr2).mint(addr2.address, _id, 1, []);
        expect(await nft.uri(_id)).to.equal(basePath + _id);
    });

    it("Should not mint without minter role", async function () {
        await expect(nft.connect(addr3).mint(addr2.address, 1, 1, [])
        ).to.be.revertedWith("MemeXNFT: Only Lottery or Minter role can mint");
    })

    it("Should calculate royalties", async function () {
        royaltyInfo = await nft.royaltyInfo(1, 100);
        expect(royaltyInfo[0]).to.equal(addr1.address);
        expect(royaltyInfo[1]).to.equal(2);
    });

    it("Should transfer from a to b", async function () {
        await nft.connect(addr2).safeTransferFrom(addr2.address, addr3.address, [1], [1], []);
        expect(await nft.balanceOf(addr2.address, _id)).to.equal(0);
        expect(await nft.balanceOf(addr3.address, _id)).to.equal(1);
    });

})