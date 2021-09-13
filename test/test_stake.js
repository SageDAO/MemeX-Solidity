const { expect } = require("chai");
const { ethers } = require("hardhat");

const rewardRateToken = 11574074074000;
const rewardRateLiquidity = 115740740740000;

describe("SoftStaking", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1000000, owner.address);
        Stake = await ethers.getContractFactory('SoftStaking');
        stake = await Stake.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
    });

    it("Check initialize rates", async function () {
        expect(await stake.getRewardRateToken()).to.equal(rewardRateToken);
        expect(await stake.getRewardRateLiquidity()).to.equal(rewardRateLiquidity);
    });

    it("Check new user didn't join", async function () {
        expect(await stake.userJoined()).to.equal(false);
    });

    it("Check after user join", async function () {
        await stake.join();
        expect(await stake.userJoined()).to.equal(true);
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
});

