const { expect } = require("chai");
const { ethers } = require("hardhat");

// const rewardRateToken = 11574074074000;
// const rewardRateLiquidity = 115740740740000;

const rewardRateToken = 1;
const rewardRateLiquidity = 2;

describe("Rewards Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
    });

    it("Should use the reward rate from the constructor", async function () {
        expect(await rewards.rewardRateToken()).to.equal(rewardRateToken);
        expect(await rewards.rewardRateLiquidity()).to.equal(rewardRateLiquidity);
    });

    it("Should respond that an unknow user didn't join", async function () {
        expect(await rewards.userJoined(owner.address)).to.equal(false);
    });

    it("Should not allow to join without MEME or liquidity position", async function () {
        await expect(rewards.connect(addr1).join()).to.be.revertedWith("MEME or MEMELP position required to join");
    });

    it("Should allow users to join memex", async function () {
        await rewards.join();
        expect(await rewards.userJoined(owner.address)).to.equal(true);
    });

    it("Should not allow users to join twice", async function () {
        await rewards.join();
        await expect(rewards.join()).to.be.revertedWith("User already joined");

    });

    it("Should allow users to join and start with 0 rewards", async function () {
        await rewards.join();
        expect(await rewards.earned(owner.address)).to.equal(0);
    });

    it("Should update rewards after a block", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        expect(await rewards.earned(owner.address)).to.not.equal(0);
    });

    it("Should allow to manually update user balance", async function () {
        await rewards.join();
        info = await rewards.userInfo(owner.address);
        await rewards.updateUserBalance(owner.address, 1, 1);
        expect(await rewards.userInfo(owner.address)).to.not.equal(info);
    });

    it("Should not call burnUserPoints if not lottery", async function () {
        await rewards.join();
        await expect(rewards.burnUserPoints(owner.address, 1)).to.be.revertedWith("Lottery calls only");
    });

    it("Should not allow to spend 0 points", async function () {
        await rewards.setLotteryAddress(addr1.address);
        await expect(rewards.connect(addr1).burnUserPoints(owner.address, 0)).to.be.revertedWith("User didn't join Memex yet");
    });

    it("Should not allow to spend points if user didn't join", async function () {
        // simulate addr1 is the lottery contract
        await rewards.setLotteryAddress(addr1.address);
        // send a transaction as the lottery contract
        await expect(rewards.connect(addr1).burnUserPoints(owner.address, 100)).to.be.revertedWith("User didn't join Memex yet");
    });

    it("Should not allow to spend more than points earned", async function () {
        // simulate addr1 is the lottery contract
        await rewards.setLotteryAddress(addr1.address);
        await rewards.join();
        // send a transaction as the lottery contract
        await expect(rewards.connect(addr1).burnUserPoints(owner.address, 100000000000)).to.be.revertedWith("not enough points");
    });

    it("Should emit event after spending points", async function () {
        await rewards.join();
        await rewards.setLotteryAddress(addr1.address);
        await ethers.provider.send("evm_mine", []);
        await expect(rewards.connect(addr1).
            burnUserPoints(owner.address, 1)).to.have.emit(rewards, "PointsUsed").withArgs(owner.address, 1);
    });

    it("Should update the user list", async function () {
        await rewards.join();
        userList = await rewards.getUserList();
        expect(userList.length).to.equal(1);
    });

    it("Should update balance 10 seconds after joining holding the meme token", async function () {
        // simulate addr1 is the lottery contract
        await rewards.setLotteryAddress(addr1.address);
        await rewards.join();
        await rewards.updateUserBalance(owner.address, 100000000, 0);
        await rewards.updateUserRewards(owner.address, 0);
        // const blockNumBefore = await ethers.provider.getBlockNumber();
        // const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        // const timestampBefore = blockBefore.timestamp;
        // console.log(timestampBefore)
        await waitAndMineBlock(10); // increase next block timestamp in 10 seconds
        // const blockNumAfter = await ethers.provider.getBlockNumber();
        // const blockAfter = await ethers.provider.getBlock(blockNumAfter);
        // const timestampAfter = blockAfter.timestamp;
        // console.log(timestampAfter)
        expect(await rewards.earned(owner.address)).to.equal(10);
    });

    it("Should update balance 10 seconds after joining holding the liquidity token", async function () {
        // simulate addr1 is the lottery contract
        await rewards.setLotteryAddress(addr1.address);
        await rewards.join();
        await rewards.updateUserBalance(owner.address, 0, 100000000);
        await rewards.updateUserRewards(owner.address, 0);
        await waitAndMineBlock(10); // increase next block timestamp in 10 seconds
        expect(await rewards.earned(owner.address)).to.equal(20);
    });

    it("Should update rewards balance after lottery burns points", async function () {
        var provider = ethers.providers.getDefaultProvider();
        await rewards.setLotteryAddress(addr1.address);
        await rewards.join();
        await rewards.updateUserBalance(owner.address, 100000000, 0);
        await rewards.updateUserRewards(owner.address, 0);
        await waitAndMineBlock(10);
        const blockNumBefore = await ethers.provider.getBlockNumber();
        // if one block is mined here, would be one extra second of rewards
        await rewards.connect(addr1).burnUserPoints(owner.address, 10);
        const blockNumAfter = await ethers.provider.getBlockNumber();
        expect(await rewards.earned(owner.address)).to.equal(blockNumAfter - blockNumBefore); // should be 0 + extra rewards if there are new blocks
    });
});

async function waitAndMineBlock(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
}