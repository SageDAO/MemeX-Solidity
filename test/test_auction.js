const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256')
const BigNumber = require('bignumber.js');

describe("Auction Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Auction = await ethers.getContractFactory('MemeXAuction');
        auction = await Auction.deploy(owner.address);
        
        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        await nft.addSmartContractRole(auction.address);
        blockNum = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNum);
    });

    it("Should create auction", async function () {
        await auction.create(addr1.address, 0, 10, 1, address(0), block.timestamp, block.timestamp + 120, 200, "ipfs://");
        let resp = await auction[0].call();
        expect(resp[0].artist).to.equal(addr1.address);

    });
});

