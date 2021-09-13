const { expect } = require("chai");
const { ethers } = require("hardhat");

const rewardRateToken = 11574074074000;
const rewardRateLiquidity = 115740740740000;

describe("SoftStaking", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1000000, owner.address);
        Stake = await ethers.getContractFactory('NoStaking');
        stake = await Stake.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
    });

    it("Check initialize rates", async function () {
        expect(await stake.getRewardRateToken()).to.equal(rewardRateToken);
        expect(await stake.getRewardRateLiquidity()).to.equal(rewardRateLiquidity);
    });

    it("Check new user didn't join", async function () {
        expect(await stake.userJoined()).to.equal(false);
    });

    it("Join without MEME position - should revert", async function () {
        await expect(stake.connect(addr1).join()).to.be.reverted;
    });

    it("Check after user join", async function () {
        await stake.join();
        expect(await stake.userJoined()).to.equal(true);
    });

    it("User tries to join twice - should revert", async function () {
        await stake.join();
        await expect(stake.join()).to.be.reverted;

    });

    it("Check user joins with 0 rewards", async function () {
        await stake.join();
        expect(await stake.earned(owner.address)).to.equal(0);
    });

    it("Check user receives rewards after a block", async function () {
        await stake.join();
        await ethers.provider.send("evm_mine", []);
        expect(await stake.earned(owner.address)).to.not.equal(0);
    });

    it("Check update user balance", async function () {
        await stake.join();
        info = await stake.getUserInfo(owner.address);
        await stake.updateUserBalance(owner.address, 1, 1);
        expect(await stake.getUserInfo(owner.address)).to.not.equal(info);
    });

    it("Check only lottery can burn points - should revert", async function () {
        await stake.join();
        await expect(stake.burnUserPoints(owner.address, 1)).to.be.reverted;
    });

    it("Burn 0 points - should revert", async function () {
        await stake.setLotteryAddress(addr1.address);
        await expect(stake.connect(addr1).burnUserPoints(owner.address, 0)).to.be.reverted;
    });

    it("Not enough points - should revert", async function () {
        // simulate addr1 is the lottery contract
        await stake.setLotteryAddress(addr1.address);
        await stake.join();
        info = await stake.earned(owner.address);
        console.log(info);
        await expect(stake.connect(addr1).burnUserPoints(owner.address, 100)).to.be.reverted;
    });

    it("Check burn points event emitted", async function () {
        await stake.join();
        await stake.setLotteryAddress(addr1.address);
        await ethers.provider.send("evm_mine", []);
        await expect(stake.connect(addr1).
            burnUserPoints(owner.address, 1)).to.have.emit(stake, "PointsUsed").withArgs(owner.address, 1);
    });

    it("Lottery burning points", async function () {
        await stake.join();
        await stake.setLotteryAddress(addr1.address);
        await ethers.provider.send("evm_mine", []);
        snapshot = await stake.earned(owner.address);
        console.log(snapshot);
        await stake.connect(addr1).burnUserPoints(owner.address, 1);
        snapshot2 = await stake.earned(owner.address);
        expect(snapshot).to.be.equal(snapshot2.sub(1));
    });
});
