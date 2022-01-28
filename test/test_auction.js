const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);

        Auction = await ethers.getContractFactory('MemeXAuction');
        auction = await Auction.deploy(nft.address, owner.address);
        
        await nft.addSmartContractRole(auction.address);
        blockNum = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNum);
        await auction.create(addr1.address, 10, 2, '0x0000000000000000000000000000000000000000', block.timestamp, block.timestamp + 120, 200, "ipfs://");
    });

    it("Should create FTM auction", async function () {
        let resp = await auction.getAuction(1);
        expect(resp.artist).to.equal(addr1.address);

    });

    it("Should allow FTM bids on FTM auction", async function () { 
        await auction.connect(addr2).bid(1, 2, {value: 2});
        let resp = await auction.getAuction(1);
        console.log(resp);
        expect(resp.highestBid).to.equal(2);
        expect(resp.highestBidder).to.equal(addr2.address);
    });
});

