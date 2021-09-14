const { parseBytes32String } = require("@ethersproject/strings");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const rewardRateToken = 1;
const rewardRateLiquidity = 2;

describe("Lottery", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1000000, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await Lottery.deploy(rewards.address);
        await rewards.setLotteryAddress(lottery.address);
        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", lottery.address);
        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);

        // create a new lottery
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(15, 0, block.timestamp, block.timestamp + 10,
            nft.address, [1, 2],
            ethers.utils.parseEther("1"), 0);

    });

    it("Check new lottery created", async function () {
        expect(await lottery.getCurrentLotteryId()).to.equal(1);
    });

    it("User buys 1 lottery ticket", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(1);
    });

    it("User buys 10 lottery tickets", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 10);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(10);
    });

    it("Lottery full - should revert", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 10,
            nft.address, [1],
            ethers.utils.parseEther("1"),
            1 // just one participant allowed
        );
        await lottery.buyTickets(2, 1);
        // should fail on the second entry
        await expect(lottery.connect(addr1).buyTickets(2, 1)).to.be.reverted;
    });

    it("User boosts", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") });
        expect(await lottery.getTotalEntries(1)).to.equal(2);
        expect(await lottery.isBooster(1, owner.address)).to.equal(true);
    });

    it("User tries to boost without funds - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("0") })).to.be.reverted;
    });

    it("User tries to boost without buying ticket - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.reverted;
    });

    it("User tries to buy ticket with wrong lottery id - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(2, 1)).to.be.reverted;
    });

    it("User tries to boost with wrong lottery id - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(2, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.reverted;
    });

    it("Run Lottery with 1 participant - mint prize", async function () {
        await rewards.join();
        await lottery.buyTickets(1, 1);
        await lottery.drawWinningNumbers(1);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "ResponseReceived");
        result = await lottery.isCallerWinner(1);
        expect(result[0]).to.equal(true);  // winner
        expect(result[1]).to.equal(1);     // prize 1
        expect(result[2]).to.equal(false); // not claimed
        await lottery.redeemNFT(1);
        result = await lottery.isCallerWinner(1);
        expect(result[0]).to.equal(true); // winner
        expect(result[1]).to.equal(1);    // prize 1
        expect(result[2]).to.equal(true); // claimed

    });

    it("Run lottery with more participants", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 10,
            nft.address, [1],
            ethers.utils.parseEther("1"), 0);
        await lottery.buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.connect(addr2).buyTickets(2, 1);

        await lottery.drawWinningNumbers(2);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "ResponseReceived");

    });

});