const { expect } = require("chai");
const { ethers } = require("hardhat");

const rewardRateToken = 1;
const rewardRateLiquidity = 2;
const timer = ms => new Promise(res => setTimeout(res, ms));

describe("Lottery Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await Lottery.deploy(rewards.address);
        await rewards.setLotteryAddress(lottery.address);
        Nft = await ethers.getContractFactory("MemeXNFTBasic");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        await nft.setLotteryContract(lottery.address);
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

    it("Same user buys a second ticket", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await lottery.buyTickets(1, 1);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(2);
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
        await expect(lottery.connect(addr1).buyTickets(2, 1)).to.be.revertedWith("Lottery is full");
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

    it("User tries to enter when lottery is not open", async function () {
        await rewards.join();
        await ethers.provider.send("evm_increaseTime", [10000000000]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(1, 1)).to.be.revertedWith("Lottery is not open");
    });


    it("User tries to boost without sending funds - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("0") })).to.be.reverted;
    });

    it("User tries to boost without buying ticket first - should revert", async function () {
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

    it("Run Lottery with 1 participant - mint prize only once", async function () {
        await rewards.join();
        await lottery.buyTickets(1, 1);
        await lottery.drawWinningNumbers(1);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "ResponseReceived");
        result = await lottery.isCallerWinner(1);
        expect(result[0]).to.equal(true);  // winner
        expect(result[1]).to.equal(1);     // prize id 1
        expect(result[2]).to.equal(false); // not claimed
        await lottery.redeemNFT(1);
        result = await lottery.isCallerWinner(1);
        expect(result[0]).to.equal(true); // winner
        expect(result[1]).to.equal(1);    // prize id 1
        expect(result[2]).to.equal(true); // claimed
        // should allow to mint only once
        await expect(lottery.redeemNFT(1)).to.be.revertedWith("Participant already claimed prize");
        await nft.setArtist(addr1.address);
        await nft.setRoayltyPercentage(2);
        roaytlyInfo = await nft.royaltyInfo(1, 200);
        expect(roaytlyInfo[0]).to.equal(addr1.address);
        expect(roaytlyInfo[1]).to.equal(4);
    });

    it("Run lottery with >1500 entries and 100 prizes", async function () {
        accounts = await ethers.getSigners()
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        // creating lottery with id = 2
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 1000,
            nft.address, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
            ethers.utils.parseEther("1"), 0);
        for (let i = 0; i < accounts.length; i++) {
            // not waiting the result of each transaction so we can improve the test time
            lottery.connect(accounts[i]).buyTickets(2, 10);
        }
        // sleep a little to allow all buyTickets to finish
        await timer(100);
        await lottery.drawWinningNumbers(2);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "LotteryStatusChanged");
    });

    it("Request to draw again after receiving random number - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await lottery.drawWinningNumbers(1);
        await mockRng.fulfillRequest(1);
        await expect(lottery.drawWinningNumbers(1)).to.be.revertedWith("Lottery must be closed");
    });

    it("Should be able to request a new random number if no response received", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await lottery.drawWinningNumbers(1);
        await ethers.provider.send("evm_mine", []);
        await lottery.drawWinningNumbers(1);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "LotteryStatusChanged");
    });
});