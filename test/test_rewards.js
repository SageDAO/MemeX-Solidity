const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256')

//const rewardRateToken = 11574074074000;
//const rewardRateLiquidity = 115740740740000;

const rewardRateToken = 1; // setting a small value to be more easily verifiable
const rewardRateLiquidity = 2;

describe("Rewards Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(rewardRateToken, rewardRateLiquidity);
        // addr2 will simulate the lottery contract
        await rewards.setLotteryAddress(addr2.address);
    });

    it("Users start with 0 rewards", async function () {
        expect(await rewards.pointsAvailable(owner.address)).to.equal(0);
    });

    it("Should throw if burn points called not by lottery contract", async function () {
        await expect(rewards.connect(addr1).burnUserPoints(addr1.address, 1500000000)).to.be.revertedWith("Lottery calls only");
    });

    it("Should throw if not enough points to burn", async function () {
        await expect(rewards.connect(addr2).burnUserPoints(addr1.address, 1500000000)).to.be.revertedWith("Not enough points");
    });

    it("Should update balance 10 seconds after holding the meme token", async function () {
        await rewards.updateUserBalance(owner.address, 100000000, 0);
        await waitAndMineBlock(10); // increase next block timestamp in 10 seconds
        expect(await rewards.pointsAvailable(owner.address)).to.equal(1000000000);
    });


    it("Should update rewards balance after lottery burns points", async function () {
        await rewards.updateUserBalance(owner.address, 1, 0);
        await waitAndMineBlock(9); // 9 seconds after this block
        await rewards.connect(addr2).burnUserPoints(owner.address, 10); // one extra second on this transaction
        expect(await rewards.pointsAvailable(owner.address)).to.equal(0);
    });

    it("Should not call setLotteryAddress if not owner", async function () {
        await expect(rewards.connect(addr1).setLotteryAddress(owner.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call updateUserBalance if not owner", async function () {
        await expect(rewards.connect(addr1).updateUserBalance(owner.address, 1, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });
});

async function waitAndMineBlock(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
}
