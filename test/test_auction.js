const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);

        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy();
        mockERC20.transfer(addr1.address, 100);
        mockERC20.transfer(addr2.address, 100);
        mockERC20.transfer(addr3.address, 100);

        Auction = await ethers.getContractFactory('MemeXAuction');
        auction = await Auction.deploy(nft.address, owner.address);
        
        await nft.addSmartContractRole(auction.address);
        blockNum = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNum);
        await auction.create(addr1.address, 10, 2, '0x0000000000000000000000000000000000000000', block.timestamp, block.timestamp + 120, 200, "ipfs://");
        await auction.create(addr1.address, 10, 2, mockERC20.address, block.timestamp, block.timestamp + 120, 200, "ipfs://");
    });

    it("Should emit event on auction creation", async function () {
        await expect(auction.create(addr1.address, 10, 2, '0x0000000000000000000000000000000000000000',
         block.timestamp, block.timestamp + 120, 200, "ipfs://")).to.emit(auction, 'AuctionCreated');
    });

    it("Should create ERC20 auction", async function () {
        let resp = await auction.getAuction(2);
        expect(resp.artist).to.equal(addr1.address);
    });

    it("Should cancel auction", async function () {
        await auction.create(addr1.address, 10, 2, '0x0000000000000000000000000000000000000000',
         block.timestamp, block.timestamp + 120, 200, "ipfs://");
        await expect(auction.cancelAuction(3)).to.emit(auction, 'AuctionCancelled');
    });

    it("Should allow FTM bids on FTM auction", async function () { 
        await auction.connect(addr2).bid(1, 2, {value: 2});
        let resp = await auction.getAuction(1);
        expect(resp.highestBid).to.equal(2);
        expect(resp.highestBidder).to.equal(addr2.address);
        expect(await ethers.provider.getBalance(auction.address)).to.equal(2);
    });

    it("Should emit event on FTM bid", async function () { 
        await expect(auction.connect(addr2).bid(1, 2, {value: 2})).to.emit(auction, 'BidPlaced');
    });

    it("Should allow ERC20 bids", async function () {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await auction.connect(addr1).bid(2, 2);
        expect (await mockERC20.balanceOf(auction.address)).to.equal(2);
        expect (await mockERC20.balanceOf(addr1.address)).to.equal(98);
        let resp = await auction.getAuction(2);
        expect(resp.highestBid).to.equal(2);
        expect(resp.highestBidder).to.equal(addr1.address);
    });

    it("Should revert if bid lower than mininum - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 1, {value: 1})).to.be.revertedWith("Bid is lower than minimum");
    });

    it("Should revert if bid lower than mininum - ERC20", async function () { 
        await mockERC20.approve(auction.address, 1);
        await expect(auction.connect(addr2).bid(2, 1)).to.be.revertedWith("Bid is lower than minimum");
    });

    it("Should revert if bidding higher than value sent - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 3, {value: 2})).to.be.revertedWith("Value != bid amount");
    });

    it("Should revert if bidding lower than value sent - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 2, {value: 3})).to.be.revertedWith("Value != bid amount");
    });

    it("Should NOT allow FTM bids on ERC20 auction", async function () { 
        await expect(auction.connect(addr2).bid(2, 2, {value: 2})).to.be.revertedWith("Auction is receiving ERC20 tokens");
    });

    it("Should revert if bid lower than highest bid - FTM", async function () {
        await auction.connect(addr2).bid(1, 3, {value: 3});
        await expect(auction.connect(addr3).bid(1, 2, {value: 2})).to.be.revertedWith("Bid is lower than highest bid");
    });

    it("Should revert if bid lower than highest bid - ERC20", async function () {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await mockERC20.connect(addr2).approve(auction.address, 3);
        await auction.connect(addr2).bid(2, 3);
        await expect(auction.connect(addr1).bid(2, 2)).to.be.revertedWith("Bid is lower than highest bid");
    });

    it("Should reverse last bid - FTM", async function () {
        await auction.connect(addr2).bid(1, 2, {value: 2});
        let balanceAfterTX = ethers.BigNumber.from(await ethers.provider.getBalance(addr2.address));
        await auction.connect(addr3).bid(1, 3, {value: 3});
        let resp = await auction.getAuction(1);
        expect(resp.highestBid).to.equal(3);
        expect(resp.highestBidder).to.equal(addr3.address);
        expect(await ethers.provider.getBalance(auction.address)).to.equal(3);
        expect(ethers.BigNumber.from(await ethers.provider.getBalance(addr2.address))).to.equal(balanceAfterTX.add(2));
    });

    it("Should reverse last bid - ERC20", async function () {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await mockERC20.connect(addr2).approve(auction.address, 3);
        await auction.connect(addr1).bid(2, 2);
        await auction.connect(addr2).bid(2, 3);
        expect (await mockERC20.balanceOf(auction.address)).to.equal(3);
        expect (await mockERC20.balanceOf(addr1.address)).to.equal(100);
        expect (await mockERC20.balanceOf(addr2.address)).to.equal(97);
    });

});

