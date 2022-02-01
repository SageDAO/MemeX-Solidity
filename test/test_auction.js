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
        auction = await Auction.deploy(owner.address);
        
        await nft.addSmartContractRole(auction.address);
        blockNum = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNum);
        await auction.createCollection(nft.address, addr1.address, 200, "ipfs://collection1");
        await auction.createCollection(nft.address, addr2.address, 500, "ipfs://collection2");
        await auction.create(1, 1, 10, 2, '0x0000000000000000000000000000000000000000', 120, nft.address, 200);
        await auction.create(1, 2, 10, 2, mockERC20.address, 120, nft.address, 200);
    });

    it("Should create auction - FTM", async function () {
        await expect(auction.create(1, 1, 10, 2, '0x0000000000000000000000000000000000000000',
         120, nft.address, 200)).to.emit(auction, 'AuctionCreated');
    });

    it("Should create auction - ERC20", async function () {
        await expect(auction.create(1, 1, 10, 2, mockERC20.address,
         120, nft.address, 200)).to.emit(auction, 'AuctionCreated');
    });

    it("Should cancel auction", async function () {
        await auction.create(1, 1,  10, 2, '0x0000000000000000000000000000000000000000',
         120, nft.address, 200);
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

    it("Should finalize auction on buy now - FTM", async function () {
        await auction.connect(addr2).bid(1, 10, {value: 10});
        let resp = await auction.getAuction(1);
        expect(resp.finished).to.equal(true);
        balance = await nft.balanceOf(addr2.address, 1);
        expect(balance).to.equal(1);
    });

    it("Should finalize auction on buy now - ERC20", async function () {
        await mockERC20.connect(addr2).approve(auction.address, 10);
        await auction.connect(addr2).bid(2, 10);
        let resp = await auction.getAuction(2);
        expect(resp.finished).to.equal(true);
        balance = await nft.balanceOf(addr2.address, 2);
        expect(balance).to.equal(1);
    });

    it("Should revert if bid lower than higest bid increment", async function () {
        await auction.create(1, 1, 0, 0, '0x0000000000000000000000000000000000000000', 120, nft.address, 200);
        await auction.connect(addr2).bid(3, 1000, {value: 1000});
        await expect(auction.connect(addr2).bid(3, 1001, {value: 1001})).to.be.revertedWith("Bid is lower than highest bid increment");
        await expect(auction.connect(addr2).bid(3, 1010, {value: 1010})).to.emit(auction, 'BidPlaced');
    });

    it("Should revert if bid lower than mininum - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 1, {value: 1})).to.be.revertedWith("Bid is lower than minimum");
    });

    it("Should revert if bid lower than mininum - ERC20", async function () { 
        await mockERC20.approve(auction.address, 1);
        await expect(auction.connect(addr2).bid(2, 1)).to.be.revertedWith("Bid is lower than minimum");
    });

    it("Should revert if bid = 0", async function () {
        await auction.create(1, 1, 10, 0, '0x0000000000000000000000000000000000000000', 120, nft.address, 200);
        await expect(auction.connect(addr2).bid(3, 0, {value: 0})).to.be.revertedWith("Bid is lower than minimum");
    });

    it("Should revert if bid higher than buy now price - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 100, {value: 100})).to.be.revertedWith("Bid higher than buy now price");
    });

    it("Should revert if bid higher than buy now price - ERC20", async function () { 
        await mockERC20.approve(auction.address, 1);
        await expect(auction.connect(addr2).bid(2, 100)).to.be.revertedWith("Bid higher than buy now price");
    });

    it("Should revert if bidding higher than value sent - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 3, {value: 2})).to.be.revertedWith("Value != bid amount");
    });

    it("Should revert if bidding lower than value sent - FTM", async function () { 
        await expect(auction.connect(addr2).bid(1, 2, {value: 3})).to.be.revertedWith("Value != bid amount");
    });

    it("Should revert if calling create not being admin", async function () {
        await expect(auction.connect(addr1).create(1, 1, 10, 2, '0x0000000000000000000000000000000000000000', 120, nft.address, 200)).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling cancel not being admin", async function () {
        await expect(auction.connect(addr1).cancelAuction(1)).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling update not being admin", async function () {
        await expect(auction.connect(addr1).updateAuction(1, 20, 3, '0x0000000000000000000000000000000000000000', block.timestamp)).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling setDefaultTimeExtension not being admin", async function () {
        await expect(auction.connect(addr1).setDefaultTimeExtension(1)).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling setBidIncrement not being admin", async function () {
        await expect(auction.connect(addr1).setBidIncrementPercentage(1)).to.be.revertedWith("Admin calls only");
    });

    it("Should set a new default time extension", async function () {
        await auction.setDefaultTimeExtension(60);
        expect (await auction.defaultTimeExtension()).to.equal(60);
    });

    it("Should set a new bidIncrementPercentage", async function () {
        await auction.setBidIncrementPercentage(200);
        expect (await auction.bidIncrementPercentage()).to.equal(200);
    });

    it("Should NOT allow FTM bids on ERC20 auction", async function () { 
        await expect(auction.connect(addr2).bid(2, 2, {value: 2})).to.be.revertedWith("Auction is receiving ERC20 tokens");
    });

    it("Should revert if bid lower than highest bid - FTM", async function () {
        await auction.connect(addr2).bid(1, 3, {value: 3});
        await expect(auction.connect(addr3).bid(1, 2, {value: 2})).to.be.revertedWith("Bid is lower than highest bid increment");
    });

    it("Should revert if bid lower than highest bid - ERC20", async function () {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await mockERC20.connect(addr2).approve(auction.address, 3);
        await auction.connect(addr2).bid(2, 3);
        await expect(auction.connect(addr1).bid(2, 2)).to.be.revertedWith("Bid is lower than highest bid");
    });

    it("Should revert if trying to bid on a finished auction", async function () {
        await auction.cancelAuction(1);
        await expect(auction.connect(addr2).bid(1, 2, {value: 2})).to.be.revertedWith("Auction is already finished");
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

    it("Should revert if trying to settle auction before the end", async function () {
        await expect(auction.settleAuction(1)).to.be.revertedWith("Auction is still running");
    });

    it("Should revert if trying to settle auction already finished", async function () {
        await auction.cancelAuction(1);
        await expect(auction.settleAuction(1)).to.be.revertedWith("Auction is already finished");
    });

    it("Should settle auction - FTM", async function () {
        await auction.connect(addr2).bid(1, 2, {value: 2});
        await ethers.provider.send("evm_increaseTime", [3601]);
        await auction.settleAuction(1);
        balance = await nft.balanceOf(addr2.address, 1);
        expect(balance).to.equal(1);
    });

    it("Should settle auction - ERC20", async function () {
        await mockERC20.connect(addr2).approve(auction.address, 2);
        await auction.connect(addr2).bid(2, 2);
        await ethers.provider.send("evm_increaseTime", [3601]);
        await auction.settleAuction(2);
        balance = await nft.balanceOf(addr2.address, 2);
        expect(balance).to.equal(1);
    });
});

