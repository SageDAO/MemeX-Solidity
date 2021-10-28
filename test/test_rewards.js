const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256')

//const rewardRateToken = 11574074074074;
//const rewardRateLiquidity = 115740740740740;

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

    it("Should update balance after 10 seconds holding the meme token", async function () {
        await rewards.updateUserBalance(owner.address, 100000000, 0);
        await waitAndMineBlock(10); // increase next block timestamp 
        expect(await rewards.pointsAvailable(owner.address)).to.equal(1000000000);
    });


    it("Should update rewards balance after lottery burns points", async function () {
        await rewards.updateUserBalance(owner.address, 1, 0);
        await waitAndMineBlock(9); // 9 seconds after this block
        await rewards.connect(addr2).burnUserPoints(owner.address, 10); // one extra second on this transaction, resulting in 10 points
        expect(await rewards.pointsAvailable(owner.address)).to.equal(0);
    });

    it("Should emit event after spending points", async function () {
        await rewards.updateUserBalance(owner.address, 1, 0);
        await expect(rewards.connect(addr2).
            burnUserPoints(owner.address, 1)).to.have.emit(rewards, "PointsUsed").withArgs(owner.address, 1, 0);
    });

    it("Should batch update", async function () {
        await rewards.updateBalanceBatch([owner.address, addr1.address, addr2.address], [1, 2, 3], [0, 0, 0]);
        await ethers.provider.send("evm_mine", []);
        expect(await rewards.pointsAvailable(owner.address)).to.equal(1);
        expect(await rewards.pointsAvailable(addr1.address)).to.equal(2);
        expect(await rewards.pointsAvailable(addr2.address)).to.equal(3);
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
